import axios from 'axios'
import axiosRetry from 'axios-retry'
import { createHmacSignature } from './signer'
import { config } from '../config/env'
import { logger } from '../lib/logger'
import { SessionManager } from '../sessions/sessionManager'

const client = axios.create({ timeout: 10_000 })

axiosRetry(client, {
  retries: 5,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) =>
    axiosRetry.isNetworkError(error) ||
    (error.response?.status !== undefined && error.response.status >= 500)
})

async function send(url: string, secret: string, event: string, payload: object): Promise<void> {
  const body = JSON.stringify({ event, data: payload, timestamp: Date.now() })
  const signature = createHmacSignature(body, secret)

  try {
    await client.post(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature': `sha256=${signature}`
      }
    })
    logger.info({ event, url }, 'Webhook dispatched')
  } catch (err) {
    logger.error({ event, url, err }, 'Webhook failed after retries')
  }
}

export async function dispatchWebhook(event: string, payload: Record<string, any>): Promise<void> {
  const sessionId = payload.sessionId

  // Per-session webhook — takes priority over global
  if (sessionId) {
    const session = SessionManager.get(sessionId)
    if (session?.webhookUrl) {
      await send(session.webhookUrl, session.webhookSecret || config.webhookSecret, event, payload)
      return
    }
  }

  // Global fallback
  if (config.webhookUrl) {
    await send(config.webhookUrl, config.webhookSecret, event, payload)
  }
}
