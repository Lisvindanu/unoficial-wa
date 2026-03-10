import { Router, Request, Response } from 'express'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import { ipWhitelist } from '../middleware/ipWhitelist'
import { SessionManager, mapStatus, buildMe } from '../sessions/sessionManager'
import { startSession, stopSession, restartSession, logoutSession, canStart } from '../sessions/sessionService'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { config } from '../config/env'

const router = Router()

function sessionResponse(sessionId: string) {
  const s = SessionManager.get(sessionId)!
  const status = mapStatus(s)
  return { name: s.name ?? sessionId, status, me: buildMe(s), engine: { engine: 'NOWEB', state: status } }
}

// ── GET /api/sessions ─────────────────────────────────────────────
router.get('/', apiKeyAuth, ipWhitelist, (_req: Request, res: Response) => {
  res.json(SessionManager.getAll())
})

// ── GET /api/sessions/:name ───────────────────────────────────────
router.get('/:name', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.name)
  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(sessionResponse(sessionId))
})

// ── POST /api/sessions — create + start (WAHA format) ────────────
router.post('/', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { name, start, config: sessionConfig } = req.body as {
    name?: string
    start?: boolean
    config?: { webhookUrl?: string; webhookSecret?: string }
  }

  const sessionId = name
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'name is required' })
    return
  }

  if (SessionManager.has(sessionId)) {
    res.json(sessionResponse(sessionId))
    return
  }

  if (!canStart()) {
    res.status(429).json({ error: `Max sessions limit (${config.maxSessions}) reached` })
    return
  }

  try {
    await startSession(sessionId, {
      name,
      webhookUrl: sessionConfig?.webhookUrl,
      webhookSecret: sessionConfig?.webhookSecret
    })
    res.status(201).json(sessionResponse(sessionId))
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to create session')
    res.status(500).json({ error: 'Failed to create session' })
  }
})

// ── POST /api/sessions/:name/start ───────────────────────────────
router.post('/:name/start', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (SessionManager.has(sessionId)) {
    res.json(sessionResponse(sessionId))
    return
  }

  if (!canStart()) {
    res.status(429).json({ error: `Max sessions limit (${config.maxSessions}) reached` })
    return
  }

  try {
    const existing = await prisma.session.findUnique({ where: { id: sessionId } })
    await startSession(sessionId, {
      name: existing?.name ?? sessionId,
      webhookUrl: existing?.webhookUrl ?? undefined,
      webhookSecret: existing?.webhookSecret ?? undefined
    })
    res.json(sessionResponse(sessionId))
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to start session')
    res.status(500).json({ error: 'Failed to start session' })
  }
})

// ── POST /api/sessions/:name/stop ────────────────────────────────
router.post('/:name/stop', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  await stopSession(sessionId)
  res.json({ name: sessionId, status: 'STOPPED' })
})

// ── POST /api/sessions/:name/restart ─────────────────────────────
router.post('/:name/restart', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    await restartSession(sessionId)
    res.json(sessionResponse(sessionId))
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to restart session')
    res.status(500).json({ error: 'Failed to restart session' })
  }
})

// ── POST /api/sessions/:name/logout ──────────────────────────────
router.post('/:name/logout', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    await logoutSession(sessionId)
    res.json({ success: true })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to logout session')
    res.status(500).json({ error: 'Failed to logout session' })
  }
})

// ── DELETE /api/sessions/:name ────────────────────────────────────
router.delete('/:name', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  await stopSession(sessionId)
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => { })
  res.json({ success: true })
})

// ── GET /api/sessions/:name/me ────────────────────────────────────
router.get('/:name/me', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.name)
  const session = SessionManager.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: `Session is ${mapStatus(session)}, not connected` })
    return
  }

  res.json(buildMe(session))
})

// ── GET /api/sessions/:name/auth/qr ──────────────────────────────
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

// ── POST /api/sessions/:name/auth/request-code ───────────────────
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

// ── Backward-compat aliases ───────────────────────────────────────

// POST /api/sessions/start (old format, body: {sessionId})
router.post('/start', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { sessionId, name, webhookUrl, webhookSecret } = req.body
  const id: string = sessionId ?? name

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'sessionId (or name) is required' })
    return
  }

  if (SessionManager.has(id)) {
    res.json(sessionResponse(id))
    return
  }

  if (!canStart()) {
    res.status(429).json({ error: `Max sessions limit (${config.maxSessions}) reached` })
    return
  }

  try {
    await startSession(id, { name: name ?? id, webhookUrl, webhookSecret })
    res.json(sessionResponse(id))
  } catch (err) {
    logger.error({ sessionId: id, err }, 'Failed to start session')
    res.status(500).json({ error: 'Failed to start session' })
  }
})

// POST /api/sessions/stop (old format, body: {sessionId})
router.post('/stop', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { sessionId } = req.body

  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  await stopSession(sessionId)
  res.json({ success: true, sessionId })
})

export default router
