import axios from 'axios'
import axiosRetry from 'axios-retry'
import { createHmacSignature } from './signer'
import { config } from '../config/env'
import { logger } from '../lib/logger'
import { SessionManager, buildMe } from '../sessions/sessionManager'

const client = axios.create({ timeout: 10_000 })

axiosRetry(client, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response?.status !== undefined && error.response.status >= 500)
})

async function send(url: string, secret: string, envelopeEvent: string, envelope: object): Promise<void> {
  const body = JSON.stringify(envelope)
  const signature = createHmacSignature(body, secret)

  try {
    await client.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Hmac': `sha256=${signature}`,
        'X-Webhook-Timestamp': String(Date.now())
      }
    })
    logger.info({ event: envelopeEvent, url }, 'Webhook dispatched')
  } catch (err) {
    logger.error({ event: envelopeEvent, url, err }, 'Webhook failed after retries')
  }
}

export async function dispatchWebhook(sessionId: string, event: string, payload: Record<string, any>): Promise<void> {
  const session = SessionManager.get(sessionId)
  const me = session ? buildMe(session) : null

  const envelope = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    session: sessionId,
    engine: 'NOWEB',
    event,
    payload,
    me,
    environment: { version: '1.0.0', engine: 'NOWEB', tier: 'CORE' }
  }

  // Per-session webhook — takes priority over global
  if (session?.webhookUrl) {
    await send(session.webhookUrl, session.webhookSecret || config.webhookSecret, event, envelope)
    return
  }

  // Global fallback
  if (config.webhookUrl) {
    await send(config.webhookUrl, config.webhookSecret, event, envelope)
  }
}
