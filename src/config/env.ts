import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiKey: process.env.API_KEY ?? '',
  allowedIps: process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) ?? [],
  databaseUrl: process.env.DATABASE_URL ?? '',
  webhookUrl: process.env.WEBHOOK_URL ?? '',
  webhookSecret: process.env.WEBHOOK_SECRET ?? '',
  maxSessions: parseInt(process.env.MAX_SESSIONS ?? '50', 10),
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
}

if (!config.apiKey) {
  console.warn('[Config] WARNING: API_KEY is not set!')
}
if (!config.adminPassword) {
  console.warn('[Config] WARNING: ADMIN_PASSWORD is not set! Dashboard login disabled.')
}
