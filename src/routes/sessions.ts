import { Router, Request, Response } from 'express'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import { ipWhitelist } from '../middleware/ipWhitelist'
import { SessionManager, mapStatus, buildMe } from '../sessions/sessionManager'
import { usePostgresAuthState } from '../sessions/authAdapter'
import { createSocket } from '../sessions/socketFactory'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { config } from '../config/env'

const router = Router()

/**
 * @swagger
 * /api/sessions/start:
 *   post:
 *     summary: Inisialisasi sesi WhatsApp baru
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 example: "tx-customer-001"
 *     responses:
 *       200:
 *         description: Sesi berhasil dimulai, tunggu QR via SSE atau webhook
 *       409:
 *         description: Sesi sudah aktif
 *       429:
 *         description: Melebihi batas maksimum sesi
 */
router.post('/start', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { sessionId: rawSessionId, name: rawName, webhookUrl, webhookSecret } = req.body
  // Accept either sessionId or name (WAHA compat)
  const sessionId: string = rawSessionId ?? rawName
  const sessionName: string | undefined = rawName ?? rawSessionId

  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'sessionId (or name) is required' })
    return
  }

  if (SessionManager.has(sessionId)) {
    const session = SessionManager.get(sessionId)!
    res.json({
      name: session.name ?? sessionId,
      status: mapStatus(session),
      me: buildMe(session),
      engine: { engine: 'NOWEB', state: mapStatus(session) }
    })
    return
  }

  if (SessionManager.count() >= config.maxSessions) {
    res.status(429).json({ error: `Max sessions limit (${config.maxSessions}) reached` })
    return
  }

  try {
    await prisma.session.upsert({
      where: { id: sessionId },
      update: { name: sessionName ?? null, status: 'pending', webhookUrl: webhookUrl ?? null, webhookSecret: webhookSecret ?? null },
      create: { id: sessionId, name: sessionName ?? null, status: 'pending', webhookUrl: webhookUrl ?? null, webhookSecret: webhookSecret ?? null }
    })

    const { state, saveCreds } = await usePostgresAuthState(sessionId)
    const sock = await createSocket(sessionId, state, saveCreds)

    SessionManager.set(sessionId, {
      socket: sock,
      status: 'pending',
      name: sessionName,
      webhookUrl: webhookUrl ?? undefined,
      webhookSecret: webhookSecret ?? undefined
    })

    logger.info({ sessionId, webhookUrl }, 'Session starting')

    res.json({
      name: sessionName ?? sessionId,
      status: 'STARTING',
      me: null,
      engine: { engine: 'NOWEB', state: 'STARTING' }
    })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to start session')
    res.status(500).json({ error: 'Failed to start session' })
  }
})

/**
 * @swagger
 * /api/sessions/stop:
 *   post:
 *     summary: Hentikan sesi WhatsApp
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesi berhasil dihentikan
 *       404:
 *         description: Sesi tidak ditemukan
 */
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

  SessionManager.delete(sessionId)
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'disconnected' }
  }).catch(() => { })

  logger.info({ sessionId }, 'Session stopped')
  res.json({ success: true, sessionId })
})

/**
 * @swagger
 * /api/sessions/{sessionId}/status:
 *   get:
 *     summary: Status sesi tertentu
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Status sesi
 *       404:
 *         description: Sesi tidak ditemukan
 */
router.get('/:sessionId/status', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId)
  const session = SessionManager.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  const status = mapStatus(session)
  res.json({
    name: session.name ?? sessionId,
    status,
    me: buildMe(session),
    engine: { engine: 'NOWEB', state: status }
  })
})

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: List semua sesi aktif
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Array sesi
 */
router.get('/', apiKeyAuth, ipWhitelist, (_req: Request, res: Response) => {
  res.json(SessionManager.getAll())
})

/**
 * @swagger
 * /api/sessions/{sessionId}/me:
 *   get:
 *     summary: Info akun WhatsApp yang login pada sesi ini
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Info akun
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi belum connected
 */
router.get('/:sessionId/me', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId)
  const session = SessionManager.get(sessionId)

  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  if (session.status !== 'connected') {
    res.status(409).json({ error: `Session is ${mapStatus(session)}, not connected` })
    return
  }

  const me = buildMe(session)
  res.json(me)
})

/**
 * @swagger
 * /api/sessions/{sessionId}/auth/qr:
 *   get:
 *     summary: Dapatkan QR code untuk pairing
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [image, raw]
 *           default: image
 *     responses:
 *       200:
 *         description: QR code (image/png atau raw string)
 *       202:
 *         description: Sesi pending, QR belum tersedia — coba lagi sebentar
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi sudah connected, tidak perlu QR
 */
router.get('/:sessionId/auth/qr', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId)
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

  // Default: image/png
  const base64Data = session.qr.replace(/^data:image\/png;base64,/, '')
  const imgBuffer = Buffer.from(base64Data, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.send(imgBuffer)
})

/**
 * @swagger
 * /api/sessions/{sessionId}/auth/request-code:
 *   post:
 *     summary: Minta kode pairing via nomor HP (tanpa scan QR)
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "628123456789"
 *     responses:
 *       200:
 *         description: Kode pairing (masukkan di WA > Perangkat Tertaut > Tautkan dengan nomor telepon)
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi sudah connected
 */
router.post('/:sessionId/auth/request-code', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId)
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
    // Strip non-digits
    const phone = phoneNumber.replace(/\D/g, '')
    const code = await session.socket.requestPairingCode(phone)
    logger.info({ sessionId, phoneNumber: phone }, 'Pairing code requested')
    res.json({ code, phoneNumber: phone })
  } catch (err) {
    logger.error({ sessionId, err }, 'Failed to request pairing code')
    res.status(500).json({ error: 'Failed to request pairing code' })
  }
})

export default router
