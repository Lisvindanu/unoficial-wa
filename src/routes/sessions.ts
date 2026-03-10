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

/**
 * @swagger
 * components:
 *   schemas:
 *     SessionStatus:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "lembaga-a"
 *         status:
 *           type: string
 *           enum: [STARTING, SCAN_QR_CODE, WORKING, STOPPED, FAILED]
 *         me:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:
 *               type: string
 *               example: "628123456789@c.us"
 *             pushName:
 *               type: string
 *               example: "Nama Profil"
 *         engine:
 *           type: object
 *           properties:
 *             engine:
 *               type: string
 *               example: "NOWEB"
 *             state:
 *               type: string
 *               example: "WORKING"
 */

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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SessionStatus'
 */
router.get('/', apiKeyAuth, ipWhitelist, (_req: Request, res: Response) => {
  res.json(SessionManager.getAll())
})

/**
 * @swagger
 * /api/sessions/{name}:
 *   get:
 *     summary: Status sesi tertentu
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: "lembaga-a"
 *     responses:
 *       200:
 *         description: Status sesi
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionStatus'
 *       404:
 *         description: Sesi tidak ditemukan
 */
router.get('/:name', apiKeyAuth, ipWhitelist, (req: Request, res: Response) => {
  const sessionId = String(req.params.name)
  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json(sessionResponse(sessionId))
})

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Buat dan mulai sesi baru (WAHA format)
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "lembaga-a"
 *               config:
 *                 type: object
 *                 properties:
 *                   webhookUrl:
 *                     type: string
 *                   webhookSecret:
 *                     type: string
 *     responses:
 *       201:
 *         description: Sesi berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionStatus'
 *       409:
 *         description: Sesi sudah ada
 *       429:
 *         description: Melebihi batas maksimum sesi
 */
router.post('/', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const { name, config: sessionConfig } = req.body as {
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

/**
 * @swagger
 * /api/sessions/{name}/start:
 *   post:
 *     summary: Start sesi (gunakan name yang sudah ada di DB)
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sesi berhasil dimulai
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionStatus'
 *       429:
 *         description: Melebihi batas maksimum sesi
 */
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

/**
 * @swagger
 * /api/sessions/{name}/stop:
 *   post:
 *     summary: Hentikan sesi
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sesi dihentikan
 *       404:
 *         description: Sesi tidak ditemukan
 */
router.post('/:name/stop', apiKeyAuth, ipWhitelist, async (req: Request, res: Response) => {
  const sessionId = String(req.params.name)

  if (!SessionManager.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' })
    return
  }

  await stopSession(sessionId)
  res.json({ name: sessionId, status: 'STOPPED' })
})

/**
 * @swagger
 * /api/sessions/{name}/restart:
 *   post:
 *     summary: Restart sesi tanpa scan ulang QR
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sesi berhasil di-restart
 *       404:
 *         description: Sesi tidak ditemukan
 */
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

/**
 * @swagger
 * /api/sessions/{name}/logout:
 *   post:
 *     summary: Logout sesi (hapus auth keys, perlu scan QR lagi)
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Berhasil logout
 *       404:
 *         description: Sesi tidak ditemukan
 */
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

/**
 * @swagger
 * /api/sessions/{name}:
 *   delete:
 *     summary: Hapus sesi permanen dari DB
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sesi dihapus
 *       404:
 *         description: Sesi tidak ditemukan
 */
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

/**
 * @swagger
 * /api/sessions/{name}/me:
 *   get:
 *     summary: Info akun WhatsApp yang login
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Info akun
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "628123456789@c.us"
 *                 pushName:
 *                   type: string
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi belum connected
 */
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

/**
 * @swagger
 * /api/sessions/{name}/auth/qr:
 *   get:
 *     summary: Dapatkan QR code untuk pairing
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
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
 *         description: QR belum tersedia, coba lagi
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi sudah connected
 */
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

/**
 * @swagger
 * /api/sessions/{name}/auth/request-code:
 *   post:
 *     summary: Minta kode pairing via nomor HP (tanpa scan QR)
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: name
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
 *         description: Kode pairing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "ABCD-EFGH"
 *                 phoneNumber:
 *                   type: string
 *       404:
 *         description: Sesi tidak ditemukan
 *       409:
 *         description: Sesi sudah connected
 */
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

/**
 * @swagger
 * /api/sessions/start:
 *   post:
 *     summary: "[Deprecated] Mulai sesi — gunakan POST /api/sessions atau POST /api/sessions/:name/start"
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               name:
 *                 type: string
 *               webhookUrl:
 *                 type: string
 *               webhookSecret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesi berhasil dimulai
 */
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

/**
 * @swagger
 * /api/sessions/stop:
 *   post:
 *     summary: "[Deprecated] Hentikan sesi — gunakan POST /api/sessions/:name/stop"
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
 *         description: Sesi dihentikan
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

  await stopSession(sessionId)
  res.json({ success: true, sessionId })
})

export default router
