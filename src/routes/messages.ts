import { Router, Request, Response } from 'express'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import { ipWhitelist } from '../middleware/ipWhitelist'
import { SessionManager } from '../sessions/sessionManager'
import { logger } from '../lib/logger'

const router = Router()

/**
 * @swagger
 * /api/messages/send:
 *   post:
 *     summary: Kirim pesan teks
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, to, text]
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *                 example: "628123456789@s.whatsapp.net"
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pesan terkirim
 *       404:
 *         description: Sesi tidak ditemukan atau belum terhubung
 */
router.post('/send', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { sessionId, to, text } = req.body

  if (!sessionId || !to || !text) {
    res.status(400).json({ error: 'sessionId, to, and text are required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: `Session is ${session.status}, not connected` })
    return
  }

  try {
    const result = await session.socket.sendMessage(to, { text })
    logger.info({ sessionId, to }, 'Message sent')
    res.json({ messageId: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, to, err }, 'Failed to send message')
    res.status(500).json({ error: 'Failed to send message' })
  }
})

/**
 * @swagger
 * /api/messages/send-media:
 *   post:
 *     summary: Kirim pesan media (image/document/audio)
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, to, type, url]
 *             properties:
 *               sessionId:
 *                 type: string
 *               to:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [image, document, audio, video]
 *               url:
 *                 type: string
 *               caption:
 *                 type: string
 *               filename:
 *                 type: string
 *     responses:
 *       200:
 *         description: Media terkirim
 */
router.post('/send-media', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { sessionId, to, type, url, caption, filename } = req.body

  if (!sessionId || !to || !type || !url) {
    res.status(400).json({ error: 'sessionId, to, type, and url are required' })
    return
  }

  const session = SessionManager.get(sessionId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: `Session is ${session.status}, not connected` })
    return
  }

  try {
    const mediaMap: Record<string, object> = {
      image: { image: { url }, caption },
      document: { document: { url }, caption, fileName: filename ?? 'file' },
      audio: { audio: { url }, mimetype: 'audio/mp4' },
      video: { video: { url }, caption }
    }

    const content = mediaMap[type]
    if (!content) {
      res.status(400).json({ error: `Unsupported media type: ${type}` })
      return
    }

    const result = await session.socket.sendMessage(to, content)
    logger.info({ sessionId, to, type }, 'Media sent')
    res.json({ messageId: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, to, err }, 'Failed to send media')
    res.status(500).json({ error: 'Failed to send media' })
  }
})

export default router
