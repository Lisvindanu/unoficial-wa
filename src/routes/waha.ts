/**
 * WAHA-compatible flat routes mounted at /api
 *
 * GET  /api/:name/auth/qr              → QR code (image or raw)
 * POST /api/:name/auth/request-code   → Pairing code
 * POST /api/sendText                  → Send text message
 * POST /api/sendImage                 → Send image
 * POST /api/sendFile                  → Send file/document
 */
import { Router, Request, Response } from 'express'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import { ipWhitelist } from '../middleware/ipWhitelist'
import { SessionManager } from '../sessions/sessionManager'
import { normalizeChatId } from '../sessions/sessionService'
import { logger } from '../lib/logger'

const router = Router()

// ── QR code ───────────────────────────────────────────────────────
router.get('/:name/auth/qr', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.name)
  const format = (req.query.format as string) || 'image'
  const session = SessionManager.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status === 'connected') {
    res.status(409).json({ error: 'Session already connected, no QR needed' })
    return
  }

  if (!session.qr || !session.qrRaw) {
    res.status(202).json({ error: 'QR not ready yet, try again in a moment' })
    return
  }

  if (format === 'raw') {
    res.json({ value: session.qrRaw })
    return
  }

  const base64Data = session.qr.replace(/^data:image\/png;base64,/, '')
  const imgBuffer = Buffer.from(base64Data, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.send(imgBuffer)
})

// ── Pairing code ──────────────────────────────────────────────────
router.post('/:name/auth/request-code', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)
  const { phoneNumber } = req.body as { phoneNumber?: string }

  if (!phoneNumber) {
    res.status(400).json({ error: 'phoneNumber is required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status === 'connected') {
    res.status(409).json({ error: 'Session already connected' })
    return
  }

  try {
    const phone = phoneNumber.replace(/\D/g, '')
    const code = await session.socket.requestPairingCode(phone)
    logger.info({ sessionId, phoneNumber: phone }, 'Pairing code requested')
    res.json({ code, phoneNumber: phone })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to request pairing code')
    res.status(500).json({ error: 'Failed to request pairing code' })
  }
})

// ── Send text ─────────────────────────────────────────────────────
router.post('/sendText', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { session: sessionId, chatId, text } = req.body as {
    session?: string
    chatId?: string
    text?: string
  }

  if (!sessionId || !chatId || !text) {
    res.status(400).json({ error: 'session, chatId, and text are required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: 'Session not connected' })
    return
  }

  try {
    const jid = normalizeChatId(chatId)
    const result = await session.socket.sendMessage(jid, { text })
    logger.info({ sessionId, chatId: jid }, 'Text sent')
    res.json({ id: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, chatId, err }, 'Failed to send text')
    res.status(500).json({ error: 'Failed to send message' })
  }
})

// ── Send image ────────────────────────────────────────────────────
router.post('/sendImage', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { session: sessionId, chatId, file, caption } = req.body as {
    session?: string
    chatId?: string
    file?: { url?: string; mimetype?: string; filename?: string }
    caption?: string
  }

  if (!sessionId || !chatId || !file?.url) {
    res.status(400).json({ error: 'session, chatId, and file.url are required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: 'Session not connected' })
    return
  }

  try {
    const jid = normalizeChatId(chatId)
    const result = await session.socket.sendMessage(jid, {
      image: { url: file.url },
      caption: caption ?? undefined
    })
    logger.info({ sessionId, chatId: jid }, 'Image sent')
    res.json({ id: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, chatId, err }, 'Failed to send image')
    res.status(500).json({ error: 'Failed to send image' })
  }
})

// ── Send file / document ──────────────────────────────────────────
router.post('/sendFile', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { session: sessionId, chatId, file, caption } = req.body as {
    session?: string
    chatId?: string
    file?: { url?: string; mimetype?: string; filename?: string }
    caption?: string
  }

  if (!sessionId || !chatId || !file?.url) {
    res.status(400).json({ error: 'session, chatId, and file.url are required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: 'Session not connected' })
    return
  }

  try {
    const jid = normalizeChatId(chatId)
    const result = await session.socket.sendMessage(jid, {
      document: { url: file.url },
      mimetype: file.mimetype ?? 'application/octet-stream',
      fileName: file.filename ?? 'file',
      caption: caption ?? undefined
    })
    logger.info({ sessionId, chatId: jid }, 'File sent')
    res.json({ id: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, chatId, err }, 'Failed to send file')
    res.status(500).json({ error: 'Failed to send file' })
  }
})

export default router
