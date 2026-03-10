import { Router, Request, Response } from 'express'
import { SseEventBus } from '../sse/eventBus'
import { SessionManager } from '../sessions/sessionManager'
import { adminAuth, setAdminCookie, clearAdminCookie, isAdminAuthenticated } from '../middleware/adminAuth'
import { startSession, stopSession, restartSession, canStart } from '../sessions/sessionService'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { config } from '../config/env'
import path from 'path'

const router = Router()

// ── Auth ──────────────────────────────────────────────────────────

router.get('/login', (req: Request, res: Response) => {
  if (isAdminAuthenticated(req)) {
    res.redirect('/dashboard')
    return
  }
  res.sendFile(path.join(process.cwd(), 'public/dashboard/login.html'))
})

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string }

  if (
    !config.adminPassword ||
    username !== config.adminUsername ||
    password !== config.adminPassword
  ) {
    res.redirect('/dashboard/login?error=1')
    return
  }

  setAdminCookie(res)
  res.redirect('/dashboard')
})

router.get('/logout', (_req: Request, res: Response) => {
  clearAdminCookie(res)
  res.redirect('/dashboard/login')
})

// ── Dashboard Pages (admin only) ──────────────────────────────────

router.get('/', adminAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public/dashboard/index.html'))
})

router.get('/scan', adminAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public/dashboard/scan.html'))
})

// ── SSE Stream (admin only) ───────────────────────────────────────

router.get('/events', adminAuth, (req: Request, res: Response) => {
  SseEventBus.subscribe(res)
  const snapshot = SessionManager.getAll()
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`)
})

// ── Dashboard Management API (admin cookie, no API key needed) ────

// GET /dashboard/api/sessions — list all sessions
router.get('/api/sessions', adminAuth, (_req: Request, res: Response) => {
  res.json(SessionManager.getAll())
})

// POST /dashboard/api/sessions/start — start new session
router.post('/api/sessions/start', adminAuth, async (req: Request, res: Response) => {
  const { sessionId, name } = req.body as { sessionId?: string; name?: string }

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId is required' })
    return
  }

  if (SessionManager.has(sessionId)) {
    const s = SessionManager.get(sessionId)!
    res.json({ status: s.status, sessionId })
    return
  }

  if (!canStart()) {
    res.status(429).json({ error: `Max sessions limit (${config.maxSessions}) reached` })
    return
  }

  try {
    await startSession(sessionId, { name: name ?? undefined })
    SseEventBus.publish('session.update', { sessionId, status: 'pending', name })
    res.json({ status: 'starting', sessionId, message: 'QR code will arrive via SSE (/dashboard/events)' })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to start session')
    res.status(500).json({ error: 'Failed to start session' })
  }
})

// POST /dashboard/api/sessions/:id/stop — stop session
router.post('/api/sessions/:id/stop', adminAuth, async (req: Request, res: Response) => {
  const sessionId = String(req.params.id)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  await stopSession(sessionId)
  SseEventBus.publish('session.update', { sessionId, status: 'disconnected' })
  res.json({ success: true, sessionId })
})

// POST /dashboard/api/sessions/:id/restart — reconnect without rescan
router.post('/api/sessions/:id/restart', adminAuth, async (req: Request, res: Response) => {
  const sessionId = String(req.params.id)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  try {
    await restartSession(sessionId)
    const s = SessionManager.get(sessionId)
    SseEventBus.publish('session.update', { sessionId, status: 'pending', name: s?.name })
    res.json({ success: true, sessionId, status: 'pending' })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to restart session')
    res.status(500).json({ error: 'Failed to restart session' })
  }
})

// PUT /dashboard/api/sessions/:id/name — rename session
router.put('/api/sessions/:id/name', adminAuth, async (req: Request, res: Response) => {
  const sessionId = String(req.params.id)
  const { name } = req.body as { name?: string }

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const trimmed = name?.trim() || null

  SessionManager.update(sessionId, { name: trimmed ?? undefined })
  await prisma.session.update({
    where: { id: sessionId },
    data: { name: trimmed }
  }).catch(() => { })

  SseEventBus.publish('session.update', {
    sessionId,
    name: trimmed,
    status: SessionManager.get(sessionId)?.status
  })

  res.json({ success: true, sessionId, name: trimmed })
})

// POST /dashboard/api/send-test — send test message (proxies internal API, no key exposed)
router.post('/api/send-test', adminAuth, async (req: Request, res: Response) => {
  const { sessionId, to, text } = req.body as { sessionId?: string; to?: string; text?: string }

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
    res.json({ messageId: result?.key?.id, status: 'sent' })
  } catch (err) {
    logger.error({ sessionId, to, err }, 'Failed to send test message')
    res.status(500).json({ error: 'Failed to send message' })
  }
})

export default router
