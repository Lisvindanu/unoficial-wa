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
        await dispatchWebhook('session.qr', { sessionId, qr: qrBase64 })

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
      await dispatchWebhook('session.connected', { sessionId, phoneNumber })

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

      // Only emit disconnect if session still tracked (avoid spam from already-deleted sessions)
      if (SessionManager.has(sessionId)) {
        SessionManager.update(sessionId, { status: 'disconnected', qr: undefined, qrRaw: undefined })
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'disconnected' }
        }).catch(() => { })

        SseEventBus.publish('session.update', { sessionId, status: 'disconnected' })
        await dispatchWebhook('session.disconnected', { sessionId, reason })
      }

      if (isLoggedOut) {
        // Auth revoked — clear session but keep DB record as STOPPED
        SessionManager.delete(sessionId)
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'disconnected' }
        }).catch(() => { })
        return
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

      const payload = {
        sessionId,
        from: msg.key.remoteJid,
        messageId: msg.key.id,
        type: Object.keys(msg.message)[0],
        text: msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || '',
        timestamp: msg.messageTimestamp
      }

      SseEventBus.publish('webhook.log', { event: 'message.received', data: payload, ts: Date.now() })
      await dispatchWebhook('message.received', payload)
    }
  })

  sock.ev.on('messages.update', async (updates: any[]) => {
    for (const update of updates) {
      if (!update.update?.status) continue

      const statusMap: Record<number, string> = { 1: 'sent', 2: 'delivered', 3: 'read', 4: 'played' }
      const payload = {
        sessionId,
        messageId: update.key.id,
        status: statusMap[update.update.status] ?? 'unknown'
      }

      SseEventBus.publish('webhook.log', { event: 'message.updated', data: payload, ts: Date.now() })
      await dispatchWebhook('message.updated', payload)
    }
  })

  return sock
}
