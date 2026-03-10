#!/usr/bin/env node

/**
 * Bulk Message Test Script
 * Mengirim pesan ke banyak nomor dengan berbagai konfigurasi delay
 * untuk mengamati rate limiting & perilaku WA
 *
 * Usage:
 *   node scripts/test-bulk-message.js [options]
 *
 * Options:
 *   --session   Session ID (default: test-001)
 *   --key       API Key
 *   --delay     Delay antar pesan dalam ms (default: 3000)
 *   --rounds    Berapa putaran kirim ke semua nomor (default: 2)
 *   --mode      'normal' | 'aggressive' | 'safe' (default: normal)
 */

const args = process.argv.slice(2)
const get = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def }

const BASE_URL  = 'http://localhost:3000'
const SESSION   = get('--session', 'test-001')
const API_KEY   = get('--key', 'dev-api-key-12345-change-in-production')
const DELAY_MS  = parseInt(get('--delay', '3000'), 10)
const ROUNDS    = parseInt(get('--rounds', '2'), 10)
const MODE      = get('--mode', 'normal')

// Target nomor
const TARGETS = [
  { name: 'Target 1', number: '6289685669959' },
  { name: 'Target 2', number: '6281572791620' },
  { name: 'Target 3', number: '6287737042785' },
  { name: 'Target 4', number: '6285121025982' },
  { name: 'Target 5', number: '6281312019512' },
  { name: 'Target 6', number: '6285725389130' },
]

// Mode config
const MODE_CONFIG = {
  safe:       { delay: 7000,  burstMax: 5,  label: '🟢 SAFE (7s delay, max 5 burst)' },
  normal:     { delay: 3000,  burstMax: 10, label: '🟡 NORMAL (3s delay, max 10 burst)' },
  aggressive: { delay: 500,   burstMax: 30, label: '🔴 AGGRESSIVE (0.5s delay, max 30 burst)' },
  extreme:    { delay: 0,     burstMax: 99, label: '💀 EXTREME (0ms delay, semua concurrent)' },
}

const modeConf = MODE_CONFIG[MODE] || MODE_CONFIG.normal

// Colors
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', gray: '\x1b[90m', blue: '\x1b[34m', magenta: '\x1b[35m'
}
const bold   = s => `${c.bold}${s}${c.reset}`
const green  = s => `${c.green}${s}${c.reset}`
const yellow = s => `${c.yellow}${s}${c.reset}`
const red    = s => `${c.red}${s}${c.reset}`
const cyan   = s => `${c.cyan}${s}${c.reset}`
const gray   = s => `${c.gray}${s}${c.reset}`
const blue   = s => `${c.blue}${s}${c.reset}`

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

function randomDelay(base) {
  // Tambah jitter ±30% biar lebih natural (hindari pattern detection)
  const jitter = base * 0.3
  return base + (Math.random() * jitter * 2 - jitter)
}

function formatMs(ms) {
  return ms >= 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`
}

// Variasi pesan biar tidak terdeteksi sebagai spam
const MESSAGE_VARIANTS = [
  (name, round, i) => `Halo ${name}! 👋 Ini pesan test dari WhatsApp API. [Round ${round}, Msg #${i}] - ${new Date().toLocaleTimeString('id-ID')}`,
  (name, round, i) => `Hai ${name}! Test bulk message ke-${i} (round ${round}). Timestamp: ${Date.now()}`,
  (name, round, i) => `[Test ${i}/${round}] ${name}, pesan ini dikirim otomatis via API untuk uji rate limit WA. ${new Date().toISOString()}`,
  (name, round, i) => `📨 Test API — Kepada: ${name} | Urutan: ${i} | Putaran: ${round} | Waktu: ${new Date().toLocaleTimeString('id-ID')}`,
]

async function sendMessage(target, text, msgIndex) {
  const start = Date.now()
  try {
    const resp = await fetch(`${BASE_URL}/api/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        sessionId: SESSION,
        to: `${target.number}@s.whatsapp.net`,
        text
      })
    })

    const elapsed = Date.now() - start
    const data = await resp.json()

    if (resp.status === 429) {
      return { ok: false, status: 429, elapsed, error: data.error, retryAfter: data.retryAfterMs }
    }

    if (!resp.ok) {
      return { ok: false, status: resp.status, elapsed, error: data.error }
    }

    return { ok: true, status: 200, elapsed, messageId: data.messageId }
  } catch (err) {
    return { ok: false, status: 0, elapsed: Date.now() - start, error: err.message }
  }
}

async function run() {
  console.log()
  console.log(bold('═'.repeat(60)))
  console.log(bold(' WhatsApp API — Bulk Message Test'))
  console.log(bold('═'.repeat(60)))
  console.log(`  Session:  ${cyan(SESSION)}`)
  console.log(`  Mode:     ${modeConf.label}`)
  console.log(`  Delay:    ${cyan(formatMs(DELAY_MS || modeConf.delay))}`)
  console.log(`  Rounds:   ${cyan(ROUNDS)}`)
  console.log(`  Targets:  ${cyan(TARGETS.length)} nomor`)
  console.log(`  Total:    ${cyan(TARGETS.length * ROUNDS)} pesan`)
  console.log()

  // Check server & session
  try {
    const h = await fetch(`${BASE_URL}/health`)
    const d = await h.json()
    console.log(green(`  ✓ Server up — ${d.sessions} session(s) aktif`))

    const s = await fetch(`${BASE_URL}/api/sessions/${SESSION}/status`, {
      headers: { 'x-api-key': API_KEY }
    })
    const sd = await s.json()
    if (sd.status !== 'connected') throw new Error(`Session ${SESSION} tidak connected (${sd.status})`)
    console.log(green(`  ✓ Session connected — nomor: +${sd.phoneNumber}`))
  } catch (err) {
    console.log(red(`  ✗ Error: ${err.message}`))
    process.exit(1)
  }

  console.log()
  console.log(bold('  Target Nomor:'))
  TARGETS.forEach((t, i) => console.log(`    ${i+1}. ${t.name} → +${t.number}`))
  console.log()
  console.log(gray('─'.repeat(60)))

  const results = { ok: 0, rateLimited: 0, error: 0, totalMs: 0 }
  const perTarget = {}
  TARGETS.forEach(t => { perTarget[t.number] = { ok: 0, fail: 0 } })

  let msgCount = 0

  for (let round = 1; round <= ROUNDS; round++) {
    console.log()
    console.log(bold(blue(`  ── Round ${round}/${ROUNDS} ──`)))

    const effectiveDelay = DELAY_MS !== undefined && args.includes('--delay')
      ? DELAY_MS
      : modeConf.delay

    if (MODE === 'extreme') {
      // EXTREME: semua nomor dikirim concurrent dalam satu round
      const roundBase = msgCount
      const batch = TARGETS.map((target, ti) => {
        const n = roundBase + ti + 1
        const variant = MESSAGE_VARIANTS[Math.floor(Math.random() * MESSAGE_VARIANTS.length)]
        const text = variant(target.name, round, n)
        return { target, text, n }
      })
      msgCount += TARGETS.length

      console.log(gray(`  Firing ${TARGETS.length} pesan concurrent sekaligus...`))
      const batchResults = await Promise.all(
        batch.map(({ target, text, n }) => sendMessage(target, text, n))
      )

      batchResults.forEach((result, ti) => {
        const { target, n } = batch[ti]
        if (result.ok) {
          results.ok++
          perTarget[target.number].ok++
          results.totalMs += result.elapsed
          console.log(`  #${String(n).padStart(2)} → ${cyan(target.name)} ... ${green('✓ SENT')}${gray(` [${result.elapsed}ms] id: ${result.messageId?.slice(-8) || '?'}`)}`)
        } else if (result.status === 429) {
          results.rateLimited++
          perTarget[target.number].fail++
          console.log(`  #${String(n).padStart(2)} → ${cyan(target.name)} ... ${red('✗ RATE LIMITED')}${gray(` retry: ${formatMs(result.retryAfter || 0)}`)}`)
        } else {
          results.error++
          perTarget[target.number].fail++
          console.log(`  #${String(n).padStart(2)} → ${cyan(target.name)} ... ${red(`✗ ERROR ${result.status}`)}${gray(` — ${result.error}`)}`)
        }
      })

      // Sedikit jeda antar round di extreme mode
      if (round < ROUNDS) {
        const gap = 200
        process.stdout.write(gray(`  ↳ gap antar round: ${gap}ms\n`))
        await sleep(gap)
      }

    } else {
      // NORMAL / AGGRESSIVE / SAFE: sequential dengan delay
      for (let ti = 0; ti < TARGETS.length; ti++) {
        const target = TARGETS[ti]
        msgCount++

        const variant = MESSAGE_VARIANTS[Math.floor(Math.random() * MESSAGE_VARIANTS.length)]
        const text = variant(target.name, round, msgCount)

        process.stdout.write(`  #${String(msgCount).padStart(2)} → ${cyan(target.name)} (+${target.number}) ... `)

        const result = await sendMessage(target, text, msgCount)

        if (result.ok) {
          results.ok++
          perTarget[target.number].ok++
          results.totalMs += result.elapsed
          console.log(green(`✓ SENT`) + gray(` [${result.elapsed}ms] id: ${result.messageId?.slice(-8) || '?'}`))
        } else if (result.status === 429) {
          results.rateLimited++
          perTarget[target.number].fail++
          console.log(red(`✗ RATE LIMITED`) + gray(` — retry after ${formatMs(result.retryAfter || 0)}`))
        } else {
          results.error++
          perTarget[target.number].fail++
          console.log(red(`✗ ERROR ${result.status}`) + gray(` — ${result.error}`))
        }

        const isLast = round === ROUNDS && ti === TARGETS.length - 1
        if (!isLast && effectiveDelay > 0) {
          const delay = randomDelay(effectiveDelay)
          process.stdout.write(gray(`      ↳ delay ${formatMs(delay)}...\n`))
          await sleep(delay)
        }
      }
    }
  }

  // Summary
  const avgMs = results.ok > 0 ? Math.round(results.totalMs / results.ok) : 0

  console.log()
  console.log(bold('═'.repeat(60)))
  console.log(bold('  📊 HASIL'))
  console.log(bold('═'.repeat(60)))
  console.log(`  Total dikirim:     ${bold(msgCount)}`)
  console.log(`  ✅ Berhasil:       ${green(bold(results.ok))}`)
  console.log(`  🚫 Rate limited:   ${results.rateLimited > 0 ? red(bold(results.rateLimited)) : gray(results.rateLimited)}`)
  console.log(`  ❌ Error:          ${results.error > 0 ? red(bold(results.error)) : gray(results.error)}`)
  console.log(`  ⏱ Avg latency:    ${cyan(avgMs + 'ms')}`)
  console.log()
  console.log(bold('  Per Nomor:'))
  TARGETS.forEach(t => {
    const pt = perTarget[t.number]
    const icon = pt.fail === 0 ? green('✓') : red('✗')
    console.log(`    ${icon} ${t.name}: ${green(pt.ok + ' ok')}, ${pt.fail > 0 ? red(pt.fail + ' fail') : gray('0 fail')}`)
  })
  console.log()

  if (results.rateLimited > 0) {
    console.log(yellow('  ⚠ Rate limit API server triggered. Coba turunkan --delay atau --rounds'))
  } else if (results.ok === msgCount) {
    console.log(green('  ✓ Semua pesan terkirim tanpa rate limiting!'))
    if (MODE === 'aggressive') {
      console.log(yellow('  ⚠ Mode aggressive: pantau apakah WA memberikan warning di HP'))
    }
  }
  console.log()
}

run().catch(err => {
  console.error(red('Fatal: ' + err.message))
  process.exit(1)
})
