import './config/env'
import express from 'express'
import path from 'path'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './config/swagger'
import { errorHandler } from './middleware/errorHandler'
import { rateLimit } from './middleware/rateLimit'
import { SessionManager } from './sessions/sessionManager'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'
import { config } from './config/env'
import { usePostgresAuthState } from './sessions/authAdapter'
import { createSocket } from './sessions/socketFactory'

import sessionsRouter from './routes/sessions'
import messagesRouter from './routes/messages'
import dashboardRouter from './routes/dashboard'
import wahaRouter from './routes/waha'

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Trust proxy (for correct IP behind Nginx)
app.set('trust proxy', 1)

// Rate limiting: 100 req per minute per IP on API routes
app.use('/api', rateLimit({ windowMs: 60_000, max: 100 }))

// Static files
app.use(express.static(path.join(process.cwd(), 'public')))

// Routes
app.use('/api/sessions', sessionsRouter)
app.use('/api/messages', messagesRouter)
app.use('/dashboard', dashboardRouter)
// WAHA-compat flat routes: /api/:name/auth/* and /api/sendText|Image|File
// Must be mounted AFTER /api/sessions and /api/messages to avoid shadowing
app.use('/api', wahaRouter)

// Swagger docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/docs/openapi.json', (_req, res) => res.json(swaggerSpec))

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    sessions: SessionManager.count(),
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  })
})

// Error handler (must be last)
app.use(errorHandler)

async function start() {
  try {
    await prisma.$connect()
    logger.info('Database connected')

    // Restore sessions that were connected before restart
    const activeSessions = await prisma.session.findMany({
      where: { status: 'connected' }
    })

    for (const session of activeSessions) {
      try {
        logger.info({ sessionId: session.id }, 'Restoring session...')
        const { state, saveCreds } = await usePostgresAuthState(session.id)
        const sock = await createSocket(session.id, state, saveCreds)
        SessionManager.set(session.id, {
          socket: sock,
          status: 'pending',
          phoneNumber: session.phoneNumber ?? undefined,
          name: session.name ?? undefined,
          webhookUrl: session.webhookUrl ?? undefined,
          webhookSecret: session.webhookSecret ?? undefined
        })
      } catch (err) {
        logger.error({ sessionId: session.id, err }, 'Failed to restore session')
      }
    }

    app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`)
      logger.info(`Dashboard: http://localhost:${config.port}/dashboard`)
      logger.info(`QR Scan:   http://localhost:${config.port}/dashboard/scan`)
      logger.info(`API Docs:  http://localhost:${config.port}/docs`)
    })
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

process.on('SIGTERM', async () => {
  logger.info('Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})

start()
