import NodeCache from 'node-cache'
import { SessionManager } from './sessionManager'
import { dispatchWebhook } from '../webhook/dispatcher'
import { SseEventBus } from '../sse/eventBus'
import { logger } from '../lib/logger'
import { prisma } from '../lib/prisma'
import QRCode from 'qrcode'

export async function createSocket(sessionId: string, authState: any, saveCreds: () => Promise<void>) {
  const makeWASocket = (await import('@whiskeysockets/baileys')).default
  const { DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = await import('@whiskeysockets/baileys')

  const { version } = await fetchLatestBaileysVersion()

  const signalCache = new NodeCache({
    stdTTL: 300,   // evict setelah 5 menit
    useClones: false  // tidak ada maxKeys — biarkan Baileys manage sendiri
  })

  const sock = makeWASocket({
    version,
    auth: {
      creds: authState.creds,
      keys: makeCacheableSignalKeyStore(authState.keys, logger.child({ sessionId }) as any, signalCache)
    },
    shouldSyncHistoryMessage: () => false,
    browser: ['WhatsApp-API', 'Chrome', '3.0.0'] as [string, string, string],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    logger: logger.child({ sessionId }) as any
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      try {
        const qrBase64 = await QRCode.toDataURL(qr)
        SessionManager.update(sessionId, { qr: qrBase64, qrRaw: qr })

        SseEventBus.publish('session.qr', { sessionId, qr: qrBase64 })
        await dispatchWebhook(sessionId, 'session.status', {
          name: sessionId,
          status: 'SCAN_QR_CODE',
          statuses: [{ status: 'SCAN_QR_CODE', timestamp: Date.now() }]
        })

        logger.info({ sessionId }, 'QR generated')
      } catch (err) {
        logger.error({ sessionId, err }, 'Failed to generate QR image')
      }
    }

    if (connection === 'open') {
      const phoneNumber = sock.user?.id?.split(':')[0] ?? undefined
      SessionManager.update(sessionId, { status: 'connected', phoneNumber, qr: undefined, qrRaw: undefined })

      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'connected', phoneNumber }
      })

      SseEventBus.publish('session.update', { sessionId, status: 'connected', phoneNumber })
      await dispatchWebhook(sessionId, 'session.status', {
        name: sessionId,
        status: 'WORKING',
        statuses: [{ status: 'WORKING', timestamp: Date.now() }]
      })

      logger.info({ sessionId, phoneNumber }, 'Session connected')
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut
      const shouldReconnect = !isLoggedOut && SessionManager.has(sessionId)

      const reason = isLoggedOut ? 'loggedOut'
        : statusCode === DisconnectReason.timedOut ? 'timedOut'
        : 'connectionClosed'

      logger.info({ sessionId, statusCode, shouldReconnect, reason }, 'Connection closed')

      if (isLoggedOut) {
        // Auth revoked by WhatsApp — clear creds and mark stopped
        SessionManager.delete(sessionId)
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'disconnected' }
        }).catch(() => { })
        SseEventBus.publish('session.update', { sessionId, status: 'disconnected' })
        await dispatchWebhook(sessionId, 'session.status', {
          name: sessionId, status: 'STOPPED',
          statuses: [{ status: 'STOPPED', timestamp: Date.now() }]
        })
        return
      }

      if (shouldReconnect) {
        // Temporary disconnect — keep status in memory as disconnected for UI,
        // but do NOT persist to DB so session can be restored after server restart
        if (SessionManager.has(sessionId)) {
          SessionManager.update(sessionId, { status: 'disconnected', qr: undefined, qrRaw: undefined })
          SseEventBus.publish('session.update', { sessionId, status: 'disconnected' })
        }
      } else if (SessionManager.has(sessionId)) {
        // Manually stopped — update DB too
        SessionManager.update(sessionId, { status: 'disconnected', qr: undefined, qrRaw: undefined })
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'disconnected' }
        }).catch(() => { })
        SseEventBus.publish('session.update', { sessionId, status: 'disconnected' })
        await dispatchWebhook(sessionId, 'session.status', {
          name: sessionId, status: 'STOPPED',
          statuses: [{ status: 'STOPPED', timestamp: Date.now() }]
        })
      }

      if (shouldReconnect) {
        // Exponential backoff: wait before reconnecting to avoid spam
        const delay = Math.min(5000, 1000 + Math.random() * 2000)
        logger.info({ sessionId, delay }, 'Reconnecting after delay...')

        setTimeout(async () => {
          // Double-check session still exists and hasn't been manually stopped
          if (!SessionManager.has(sessionId)) {
            logger.info({ sessionId }, 'Session was removed during reconnect delay, aborting')
            return
          }
          try {
            const { usePostgresAuthState } = await import('./authAdapter')
            const { state, saveCreds: newSaveCreds } = await usePostgresAuthState(sessionId)
            const newSock = await createSocket(sessionId, state, newSaveCreds)
            SessionManager.update(sessionId, { socket: newSock, status: 'pending' })
          } catch (err) {
            logger.error({ sessionId, err }, 'Failed to reconnect')
            SessionManager.update(sessionId, { status: 'disconnected' })
          }
        }, delay)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }: any) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue

      const fromJid = msg.key.remoteJid ?? ''
      const fromCUs = fromJid.replace('@s.whatsapp.net', '@c.us').replace('@g.us', '@g.us')
      const myPhone = sock.user?.id?.split(':')[0] ?? ''
      const msgId = msg.key.id ?? ''
      const fromMe = msg.key.fromMe ?? false

      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || ''

      const hasMedia = !!(msg.message?.imageMessage || msg.message?.videoMessage
        || msg.message?.audioMessage || msg.message?.documentMessage)

      const wahaPayload = {
        id: `${fromMe ? 'true' : 'false'}_${fromCUs}_${msgId}`,
        timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
        from: fromCUs,
        fromMe,
        source: 'api',
        to: myPhone ? `${myPhone}@c.us` : '',
        body: text,
        hasMedia,
        ack: -1,
        ackName: 'ERROR'
      }

      SseEventBus.publish('webhook.log', { event: 'message', data: wahaPayload, ts: Date.now() })
      await dispatchWebhook(sessionId, 'message', wahaPayload)
    }
  })

  sock.ev.on('messages.update', async (updates: any[]) => {
    for (const update of updates) {
      if (!update.update?.status) continue

      const ackNames: Record<number, string> = { 0: 'PENDING', 1: 'SERVER', 2: 'DELIVERED', 3: 'READ', 4: 'PLAYED' }
      const ackNum = update.update?.status ?? 0
      const wahaAck = {
        id: update.key.id,
        from: update.key.remoteJid?.replace('@s.whatsapp.net', '@c.us') ?? '',
        fromMe: update.key.fromMe ?? false,
        ack: ackNum,
        ackName: ackNames[ackNum] ?? 'ERROR'
      }

      SseEventBus.publish('webhook.log', { event: 'message.ack', data: wahaAck, ts: Date.now() })
      await dispatchWebhook(sessionId, 'message.ack', wahaAck)
    }
  })

  return sock
}
