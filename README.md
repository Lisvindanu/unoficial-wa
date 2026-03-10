# WA-API — WhatsApp Multi-Session REST API

API server untuk mengirim dan menerima pesan WhatsApp via REST, tanpa browser, menggunakan library [Baileys](https://github.com/WhiskeySockets/Baileys). Mendukung multi-session, webhook per-sesi, admin dashboard, dan persistensi sesi via PostgreSQL.

---

## Daftar Isi

- [Fitur](#fitur)
- [Tech Stack](#tech-stack)
- [Quickstart](#quickstart)
- [Konfigurasi](#konfigurasi)
- [Admin Dashboard](#admin-dashboard)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Sessions](#sessions)
  - [Auth (QR & Pairing Code)](#auth-qr--pairing-code)
  - [Messages](#messages)
- [Webhook Events](#webhook-events)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [Keamanan](#keamanan)
- [Rate Limiting](#rate-limiting)
- [Deployment (Production)](#deployment-production)
- [Database Schema](#database-schema)
- [Scripts Testing](#scripts-testing)
- [Catatan Teknis](#catatan-teknis)

---

## Fitur

- **Multi-session** — kelola banyak nomor WA sekaligus (default maks 50)
- **REST API** — endpoint standar dengan autentikasi API key
- **Persistensi sesi** — auth state disimpan di PostgreSQL, sesi otomatis restore setelah server restart
- **Webhook per-sesi** — setiap sesi bisa punya webhook URL sendiri, tidak harus satu URL global
- **QR Code endpoint** — `GET /api/sessions/{id}/auth/qr` mengembalikan PNG atau raw string
- **Pairing Code** — auth tanpa scan QR, cukup masukkan kode di WA Settings
- **Admin Dashboard** — login dengan username/password, manage semua sesi dari browser
- **Session naming** — beri nama/label lembaga per sesi, bisa diedit inline
- **Restart session** — reconnect sesi tanpa scan QR ulang
- **SSE realtime** — monitor sesi & log webhook live di dashboard
- **Rate limiting** — 100 request/menit per IP (in-memory, no Redis)
- **IP Whitelist** — batasi akses API per IP (opsional)
- **Swagger UI** — dokumentasi interaktif di `/docs`
- **Media messaging** — kirim gambar, dokumen, audio, video

---

## Tech Stack

| Komponen | Library | Versi |
|---|---|---|
| Runtime | Node.js | 20+ LTS |
| Framework | Express.js | 5.2 |
| WhatsApp Engine | @whiskeysockets/baileys | 7.0.0-rc.9 |
| Database ORM | Prisma | 5 |
| Database | PostgreSQL | 14+ |
| Logging | Pino | 10 |
| API Docs | swagger-jsdoc + swagger-ui | 6 + 5 |

---

## Quickstart

### 1. Clone & install dependencies

```bash
git clone <repo-url> wa-api
cd wa-api
npm install
```

### 2. Setup environment

```bash
cp .env.example .env
# Edit .env sesuai kebutuhan
```

Minimal yang wajib diisi:

```env
API_KEY=ganti-dengan-api-key-yang-kuat
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_api
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password-dashboard-kamu
```

### 3. Setup database

```bash
createdb whatsapp_api
npx prisma db push
```

### 4. Jalankan server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

### 5. Mulai sesi

**Via dashboard (admin):**
```
http://localhost:3000/dashboard/scan
```

**Via API (lembaga self-onboard):**
```bash
# 1. Start session
curl -X POST http://localhost:3000/api/sessions/start \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"sessionId":"lembaga-abc","webhookUrl":"https://lembaga-abc.com/webhook"}'

# 2. Ambil QR (poll sampai 200)
curl http://localhost:3000/api/sessions/lembaga-abc/auth/qr \
  -H "x-api-key: YOUR_API_KEY" \
  --output qr.png

# 3. Cek status
curl http://localhost:3000/api/sessions/lembaga-abc/status \
  -H "x-api-key: YOUR_API_KEY"
```

---

## Konfigurasi

| Variable | Wajib | Default | Keterangan |
|---|---|---|---|
| `PORT` | | `3000` | Port server |
| `NODE_ENV` | | `development` | `development` / `production` |
| `API_KEY` | ✓ | — | API key untuk semua endpoint `/api/*` |
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `ADMIN_USERNAME` | | `admin` | Username login dashboard |
| `ADMIN_PASSWORD` | ✓ | — | Password login dashboard |
| `WEBHOOK_URL` | | _(kosong)_ | Webhook URL global (fallback jika sesi tidak punya webhook sendiri) |
| `WEBHOOK_SECRET` | | — | Secret HMAC global |
| `ALLOWED_IPS` | | _(kosong)_ | Whitelist IP, pisahkan koma. Kosong = semua diizinkan |
| `MAX_SESSIONS` | | `50` | Maks sesi aktif |

Contoh `.env` production:

```env
PORT=3000
NODE_ENV=production
API_KEY=sup3r-s3cr3t-api-k3y

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsapp_api

ADMIN_USERNAME=admin
ADMIN_PASSWORD=password-yang-kuat

WEBHOOK_URL=https://your-app.com/webhook
WEBHOOK_SECRET=rahasia-webhook-hmac

ALLOWED_IPS=
MAX_SESSIONS=50
```

---

## Admin Dashboard

Dashboard diakses via browser, dilindungi dengan login username/password.

| URL | Keterangan |
|---|---|
| `/dashboard/login` | Halaman login admin |
| `/dashboard` | Monitor semua sesi + webhook log realtime |
| `/dashboard/scan` | Tambah sesi baru + scan QR |
| `/docs` | Swagger UI — dokumentasi interaktif |
| `/health` | Health check (publik) |

### Fitur Dashboard

- **Lihat semua sesi** — status, nomor HP, nama lembaga
- **Beri nama / edit nama** — klik nama di tabel, langsung edit inline
- **Restart sesi** — reconnect tanpa scan QR ulang (gunakan auth tersimpan di DB)
- **Stop sesi** — putuskan koneksi
- **Tambah sesi baru** — isi nama + session ID, scan QR langsung di browser
- **Webhook log live** — semua event masuk tampil realtime via SSE

---

## API Reference

Semua endpoint `/api/*` memerlukan header:

```
x-api-key: YOUR_API_KEY
```

Dokumentasi interaktif: `http://localhost:3000/docs`

---

### Health Check

#### `GET /health`

Tidak memerlukan autentikasi.

```json
{
  "status": "ok",
  "sessions": 3,
  "uptime": 3600,
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

---

### Sessions

#### `POST /api/sessions/start`

Inisialisasi sesi baru. Mendukung webhook URL per-sesi.

**Request:**
```json
{
  "sessionId": "lembaga-abc",
  "webhookUrl": "https://lembaga-abc.com/webhook",
  "webhookSecret": "rahasia-lembaga-abc"
}
```

| Field | Wajib | Keterangan |
|---|---|---|
| `sessionId` | ✓ | ID unik, bebas, tidak bisa diubah |
| `webhookUrl` | | URL webhook sesi ini. Jika diisi, event hanya dikirim ke sini, bukan ke webhook global |
| `webhookSecret` | | Secret HMAC untuk webhook sesi ini. Jika kosong, pakai `WEBHOOK_SECRET` global |

**Response 200:**
```json
{
  "status": "starting",
  "sessionId": "lembaga-abc",
  "message": "QR code will arrive via SSE (/dashboard/events) or webhook"
}
```

**Response 409** — sudah aktif:
```json
{ "status": "already_connected", "sessionId": "lembaga-abc" }
```

**Response 429** — melebihi batas:
```json
{ "error": "Max sessions limit (50) reached" }
```

---

#### `POST /api/sessions/stop`

**Request:**
```json
{ "sessionId": "lembaga-abc" }
```

**Response 200:**
```json
{ "success": true, "sessionId": "lembaga-abc" }
```

---

#### `GET /api/sessions/:sessionId/status`

**Response 200:**
```json
{
  "sessionId": "lembaga-abc",
  "status": "connected",
  "phoneNumber": "6281234567890"
}
```

| `status` | Keterangan |
|---|---|
| `pending` | Menunggu QR di-scan |
| `connected` | Terhubung, siap kirim pesan |
| `disconnected` | Terputus |

---

#### `GET /api/sessions/:sessionId/me`

Info akun WhatsApp yang sedang login pada sesi ini.

**Response 200:**
```json
{
  "sessionId": "lembaga-abc",
  "id": "6281234567890:0@s.whatsapp.net",
  "phoneNumber": "6281234567890",
  "name": "Nama Push WA"
}
```

**Response 409** — sesi belum connected.

---

#### `GET /api/sessions`

List semua sesi aktif di memory.

```json
[
  { "id": "lembaga-abc", "status": "connected", "phoneNumber": "6281234567890", "name": "Lembaga ABC" },
  { "id": "lembaga-xyz", "status": "pending",   "phoneNumber": null,            "name": null }
]
```

---

### Auth (QR & Pairing Code)

#### `GET /api/sessions/:sessionId/auth/qr`

Ambil QR code untuk pairing. Poll endpoint ini sampai mendapat response 200.

**Query params:**

| Param | Value | Keterangan |
|---|---|---|
| `format` | `image` (default) | Response `image/png` — bisa langsung ditaruh di `<img src>` |
| `format` | `raw` | Response JSON `{ "value": "2@xxx..." }` — raw string QR |

**Response codes:**

| Code | Keterangan |
|---|---|
| `200` | QR siap |
| `202` | QR belum tersedia, coba lagi dalam 1–2 detik |
| `404` | Session tidak ditemukan |
| `409` | Sudah connected, tidak perlu QR |

**Contoh — tampilkan QR di HTML:**
```html
<img src="http://localhost:3000/api/sessions/lembaga-abc/auth/qr?format=image"
     style="width:240px">
```

**Contoh — polling di JavaScript:**
```javascript
async function waitForQr(sessionId) {
  while (true) {
    const res = await fetch(`/api/sessions/${sessionId}/auth/qr`, {
      headers: { 'x-api-key': API_KEY }
    })
    if (res.ok) {
      const blob = await res.blob()
      document.getElementById('qr').src = URL.createObjectURL(blob)
      break
    }
    if (res.status === 409) break // sudah connected
    await new Promise(r => setTimeout(r, 2000)) // tunggu 2 detik lalu coba lagi
  }
}
```

---

#### `POST /api/sessions/:sessionId/auth/request-code`

Auth tanpa scan QR — minta kode pairing via nomor HP. Lebih mudah untuk self-onboard.

**Request:**
```json
{ "phoneNumber": "628123456789" }
```

**Response 200:**
```json
{
  "code": "ABCD-1234",
  "phoneNumber": "628123456789"
}
```

Instruksikan user untuk masukkan kode di:
**WhatsApp → Setelan → Perangkat Tertaut → Tautkan dengan nomor telepon**

> Pastikan sesi sudah di-start (`POST /api/sessions/start`) sebelum request kode.

---

### Messages

#### `POST /api/messages/send`

Kirim pesan teks.

**Request:**
```json
{
  "sessionId": "lembaga-abc",
  "to": "628987654321@s.whatsapp.net",
  "text": "Halo dari API!"
}
```

Format nomor: `{kode_negara}{nomor}@s.whatsapp.net` — contoh: `628123456789@s.whatsapp.net`

**Response 200:**
```json
{ "messageId": "BAE5FB3C2B0F1234", "status": "sent" }
```

---

#### `POST /api/messages/send-media`

Kirim media (gambar, dokumen, audio, video).

**Request:**
```json
{
  "sessionId": "lembaga-abc",
  "to": "628987654321@s.whatsapp.net",
  "type": "image",
  "url": "https://example.com/foto.jpg",
  "caption": "Caption opsional",
  "filename": "nama-file.pdf"
}
```

| `type` | Keterangan |
|---|---|
| `image` | Gambar dengan caption |
| `document` | File/dokumen dengan filename |
| `audio` | Audio (format mp4) |
| `video` | Video dengan caption |

**Response 200:**
```json
{ "messageId": "BAE5FB3C2B0F5678", "status": "sent" }
```

---

## Webhook Events

### Webhook Per-Sesi vs Global

| Prioritas | Kondisi | Dikirim ke |
|---|---|---|
| 1 (utama) | Sesi punya `webhookUrl` sendiri | URL webhook sesi tersebut |
| 2 (fallback) | Tidak ada webhook sesi | `WEBHOOK_URL` global di `.env` |
| — | Keduanya kosong | Tidak dikirim |

Ini memungkinkan setiap lembaga terima event sesi mereka sendiri ke sistem mereka masing-masing.

### Format Payload

```json
{
  "event": "nama.event",
  "data": { ... },
  "timestamp": 1705312800000
}
```

### Verifikasi Signature

Header `X-Hub-Signature` dikirim di setiap request:

```
X-Hub-Signature: sha256=<hmac_hex>
```

Verifikasi di sisi penerima (Node.js):

```javascript
const crypto = require('crypto')

function verifyWebhook(rawBody, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-hub-signature']
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature')
  }
  const { event, data } = JSON.parse(req.body)
  // proses event...
  res.sendStatus(200)
})
```

### Daftar Events

#### `session.qr`
QR code baru tersedia.

```json
{
  "event": "session.qr",
  "data": {
    "sessionId": "lembaga-abc",
    "qr": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

`qr` adalah data URI base64 PNG, langsung pakai di `<img src="...">`.

#### `session.connected`
Sesi berhasil terhubung (QR di-scan atau pairing code dimasukkan).

```json
{
  "event": "session.connected",
  "data": { "sessionId": "lembaga-abc", "phoneNumber": "6281234567890" }
}
```

#### `session.disconnected`
Sesi terputus.

```json
{
  "event": "session.disconnected",
  "data": { "sessionId": "lembaga-abc", "reason": "connectionClosed" }
}
```

| `reason` | Reconnect otomatis? |
|---|---|
| `loggedOut` | ❌ Tidak — user logout dari HP |
| `timedOut` | ✅ Ya |
| `connectionClosed` | ✅ Ya |

#### `message.received`
Pesan masuk.

```json
{
  "event": "message.received",
  "data": {
    "sessionId": "lembaga-abc",
    "from": "628987654321@s.whatsapp.net",
    "messageId": "BAE5FB3C2B0F9ABC",
    "type": "conversation",
    "text": "Halo!",
    "timestamp": 1705312800
  }
}
```

#### `message.updated`
Status pengiriman pesan berubah.

```json
{
  "event": "message.updated",
  "data": {
    "sessionId": "lembaga-abc",
    "messageId": "BAE5FB3C2B0F1234",
    "status": "read"
  }
}
```

| `status` | Keterangan |
|---|---|
| `sent` | Terkirim ke server WA |
| `delivered` | Diterima di HP tujuan |
| `read` | Dibaca |
| `played` | Audio diputar |

### Retry Policy

| Attempt | Delay |
|---|---|
| 1 | 1 detik |
| 2 | 2 detik |
| 3 | 4 detik |
| 4 | 8 detik |
| 5 | 16 detik |

Retry untuk network error atau HTTP 5xx. HTTP 4xx tidak di-retry.

---

## Server-Sent Events (SSE)

#### `GET /dashboard/events`

Stream realtime. Memerlukan login admin (cookie `wa_admin`).

```javascript
const es = new EventSource('/dashboard/events')

es.addEventListener('snapshot', e => {
  const sessions = JSON.parse(e.data) // semua sesi saat ini
})

es.addEventListener('session.qr', e => {
  const { sessionId, qr } = JSON.parse(e.data)
  document.getElementById('qr-img').src = qr
})

es.addEventListener('session.update', e => {
  const { sessionId, status, phoneNumber, name } = JSON.parse(e.data)
})

es.addEventListener('webhook.log', e => {
  const { event, data, ts } = JSON.parse(e.data)
})
```

| Event | Data |
|---|---|
| `snapshot` | `Array<{id, status, phoneNumber, name}>` — dikirim sekali saat connect |
| `session.qr` | `{sessionId, qr}` |
| `session.update` | `{sessionId, status, phoneNumber, name}` |
| `webhook.log` | `{event, data, ts}` |

---

## Keamanan

### API Key

```
x-api-key: YOUR_API_KEY
```

Validasi dengan `crypto.timingSafeEqual()` (anti timing attack).

### Admin Dashboard

Login dengan `ADMIN_USERNAME` + `ADMIN_PASSWORD`. Cookie HTTP-only, signed dengan HMAC-SHA256, expire 24 jam.

### IP Whitelist

```env
ALLOWED_IPS=203.0.113.10,10.0.0.5
```

Kosong = semua IP boleh akses.

### Webhook Signature

Setiap request webhook menyertakan `X-Hub-Signature: sha256=<hex>`. Verifikasi wajib di sisi penerima.

---

## Rate Limiting

- **Limit:** 100 request/menit per IP
- **Scope:** `/api/*` saja
- `/health`, `/dashboard`, `/docs` tidak kena rate limit

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705312860
```

Response 429:
```json
{ "error": "Too many requests", "retryAfter": 45, "retryAfterMs": 45000 }
```

---

## Deployment (Production)

### PM2

```bash
npm run build
```

`ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'wa-api',
    script: './dist/index.js',
    instances: 1,        // HARUS 1 — SessionManager in-memory
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Nginx

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # SSE — wajib disable buffering
    location /dashboard/events {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

### Checklist Production

- [ ] `API_KEY` — nilai yang kuat dan random
- [ ] `ADMIN_PASSWORD` — bukan nilai default
- [ ] `WEBHOOK_SECRET` — nilai yang kuat
- [ ] `NODE_ENV=production`
- [ ] SSL/TLS aktif di Nginx
- [ ] Port 3000 tidak expose langsung (hanya lewat Nginx)
- [ ] PostgreSQL tidak expose ke publik
- [ ] Server: minimal **4GB RAM, 2 vCPU** untuk 30 sesi

---

## Database Schema

```prisma
model Session {
  id            String    @id              // sessionId — user-defined
  name          String?                    // label/nama lembaga
  status        String    @default("pending")
  phoneNumber   String?
  webhookUrl    String?                    // webhook URL per-sesi
  webhookSecret String?                    // webhook secret per-sesi
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  authKeys      AuthKey[]
}

model AuthKey {
  id        String   @id @default(cuid())
  sessionId String
  keyType   String   // creds | pre-key | session | sender-key | dsb
  keyId     String
  keyData   Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, keyType, keyId])
  @@index([sessionId])
}
```

---

## Scripts Testing

### Test Rate Limit

```bash
node scripts/test-rate-limit.js [--session <id>] [--key <apikey>] [--mode burst|gradual|boundary]
```

### Test Bulk Message

```bash
node scripts/test-bulk-message.js [--session <id>] [--mode safe|normal|aggressive|extreme] [--rounds <n>]
```

| Mode | Delay | Keterangan |
|---|---|---|
| `safe` | 7 detik | Risiko ban minimal |
| `normal` | 3 detik | Penggunaan harian |
| `aggressive` | 500ms | Cepat, pantau warning WA |
| `extreme` | 0ms | Semua nomor concurrent |

---

## Catatan Teknis

### Sesi Otomatis Restore
Saat server restart, semua sesi `connected` di DB otomatis di-restore. Tidak perlu scan QR ulang selama belum logout dari HP.

### Reconnect Otomatis
Koneksi terputus (bukan logout) → Baileys reconnect otomatis menggunakan auth state dari PostgreSQL.

### Single Instance
SessionManager menggunakan in-memory Map. Server **harus** dijalankan sebagai single process. Jangan gunakan `cluster` mode atau multiple PM2 instances.

### Format Nomor WA
Format: `{kode_negara}{nomor}@s.whatsapp.net` tanpa `+`.
- Indonesia: `628123456789@s.whatsapp.net`
- Singapura: `6591234567@s.whatsapp.net`
- Malaysia: `60123456789@s.whatsapp.net`

### Webhook Priority
Per-sesi webhook selalu diutamakan. Global webhook hanya sebagai fallback. Jika keduanya tidak dikonfigurasi, event tidak dikirim (normal untuk setup tanpa integrasi eksternal).
