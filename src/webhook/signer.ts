import crypto from 'crypto'

export function createHmacSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}
