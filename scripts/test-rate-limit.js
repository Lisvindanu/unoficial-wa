#!/usr/bin/env node

/**
 * Rate Limit Test Script
 *
 * Usage:
 *   node scripts/test-rate-limit.js [options]
 *
 * Options:
 *   --url       Base URL (default: http://localhost:3000)
 *   --key       API Key (default: dev-api-key-12345-change-in-production)
 *   --total     Total requests to fire (default: 120)
 *   --concur    Concurrent requests per batch (default: 10)
 *   --endpoint  Endpoint to hit (default: /health)
 *   --mode      'burst' | 'gradual' | 'boundary' (default: burst)
 */

const args = process.argv.slice(2)
const get = (flag, def) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : def
}

const BASE_URL = get('--url', 'http://localhost:3000')
const API_KEY  = get('--key', 'dev-api-key-12345-change-in-production')
const TOTAL    = parseInt(get('--total', '120'), 10)
const CONCUR   = parseInt(get('--concur', '10'), 10)
const ENDPOINT = get('--endpoint', '/health')
const MODE     = get('--mode', 'burst')

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
}

const bold = s => `${c.bold}${s}${c.reset}`
const green = s => `${c.green}${s}${c.reset}`
const yellow = s => `${c.yellow}${s}${c.reset}`
const red = s => `${c.red}${s}${c.reset}`
const cyan = s => `${c.cyan}${s}${c.reset}`
const gray = s => `${c.gray}${s}${c.reset}`
const blue = s => `${c.blue}${s}${c.reset}`

async function doRequest(n) {
  const start = Date.now()
  try {
    const resp = await fetch(`${BASE_URL}${ENDPOINT}`, {
      headers: { 'x-api-key': API_KEY }
    })
    const elapsed = Date.now() - start
    const remaining = resp.headers.get('x-ratelimit-remaining') ?? '?'
    const limit     = resp.headers.get('x-ratelimit-limit') ?? '?'
    const reset     = resp.headers.get('x-ratelimit-reset') ?? '?'

    return {
      n,
      status: resp.status,
      elapsed,
      remaining,
      limit,
      reset,
      ok: resp.ok
    }
  } catch (err) {
    return { n, status: 0, elapsed: Date.now() - start, error: err.message, ok: false }
  }
}

function printResult(r) {
  const statusStr = r.status === 429
    ? red(`[429 RATE LIMITED]`)
    : r.status === 200
    ? green(`[200 OK]`)
    : r.status === 0
    ? red(`[ERR: ${r.error}]`)
    : yellow(`[${r.status}]`)

  const remaining = r.remaining !== '?' ? (parseInt(r.remaining) < 10 ? red(r.remaining) : green(r.remaining)) : gray('?')

  console.log(
    `  #${String(r.n).padStart(3)}  ${statusStr}  ${r.elapsed}ms  ` +
    `remaining: ${remaining}/${gray(r.limit)}`
  )
}

async function runBurst() {
  console.log(bold(`\n🔥 BURST MODE — ${TOTAL} requests in batches of ${CONCUR}\n`))

  const results = { ok: 0, limited: 0, error: 0 }
  let n = 0

  for (let i = 0; i < Math.ceil(TOTAL / CONCUR); i++) {
    const batch = []
    for (let j = 0; j < CONCUR && n < TOTAL; j++, n++) {
      batch.push(doRequest(n + 1))
    }

    const batchResults = await Promise.all(batch)
    console.log(gray(`  --- Batch ${i + 1} ---`))
    for (const r of batchResults) {
      printResult(r)
      if (r.status === 429) results.limited++
      else if (r.ok) results.ok++
      else results.error++
    }
  }

  return results
}

async function runGradual() {
  console.log(bold(`\n🐢 GRADUAL MODE — ${TOTAL} requests with 50ms delay each\n`))

  const results = { ok: 0, limited: 0, error: 0 }

  for (let i = 0; i < TOTAL; i++) {
    const r = await doRequest(i + 1)
    printResult(r)

    if (r.status === 429) {
      results.limited++
      console.log(yellow(`      ↳ Rate limited! Will reset at: ${new Date(parseInt(r.reset) * 1000).toLocaleTimeString()}`))
    } else if (r.ok) results.ok++
    else results.error++

    await new Promise(res => setTimeout(res, 50))
  }

  return results
}

async function runBoundary() {
  console.log(bold(`\n🎯 BOUNDARY MODE — Testing around the rate limit boundary\n`))
  console.log(gray('  Sending 95 OK requests, then 10 more to trigger limit, then wait and retry\n'))

  const results = { ok: 0, limited: 0, error: 0 }

  // Phase 1: 95 requests (should all pass with 100/min limit)
  console.log(cyan('  Phase 1: Sending 95 requests rapidly...'))
  const phase1 = await Promise.all(Array.from({ length: 95 }, (_, i) => doRequest(i + 1)))
  for (const r of phase1) {
    if (r.ok) results.ok++
    else if (r.status === 429) results.limited++
    else results.error++
  }
  const p1ok = phase1.filter(r => r.ok).length
  const p1limited = phase1.filter(r => r.status === 429).length
  console.log(green(`  ✓ Phase 1 done: ${p1ok} OK, ${p1limited} limited\n`))

  // Phase 2: 10 more requests — should start hitting limit
  console.log(cyan('  Phase 2: Sending 10 more requests to trigger rate limit...'))
  const phase2 = await Promise.all(Array.from({ length: 10 }, (_, i) => doRequest(95 + i + 1)))
  for (const r of phase2) {
    printResult(r)
    if (r.ok) results.ok++
    else if (r.status === 429) results.limited++
    else results.error++
  }

  if (results.limited > 0) {
    console.log(green('\n  ✓ Rate limiting is working correctly!\n'))

    // Phase 3: Wait for reset and retry
    console.log(cyan('  Phase 3: Waiting 62 seconds for rate limit window to reset...'))
    for (let i = 62; i > 0; i--) {
      process.stdout.write(`\r  ${gray(`Waiting... ${i}s remaining`)}`)
      await new Promise(res => setTimeout(res, 1000))
    }
    console.log('\n')

    console.log(cyan('  Phase 3: Sending 3 requests after reset...'))
    const phase3 = await Promise.all(Array.from({ length: 3 }, (_, i) => doRequest(105 + i + 1)))
    for (const r of phase3) {
      printResult(r)
      if (r.ok) results.ok++
      else if (r.status === 429) results.limited++
      else results.error++
    }

    if (phase3.every(r => r.ok)) {
      console.log(green('\n  ✓ Rate limit correctly reset after window!\n'))
    }
  } else {
    console.log(yellow('\n  ⚠ No rate limiting triggered. Limit might be higher than 105 req/min\n'))
  }

  return results
}

function printSummary(results, startTime) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const total = results.ok + results.limited + results.error

  console.log()
  console.log(bold('─'.repeat(50)))
  console.log(bold('📊 SUMMARY'))
  console.log(bold('─'.repeat(50)))
  console.log(`  Total requests:    ${bold(total)}`)
  console.log(`  ✅ Success (2xx):  ${green(bold(results.ok))}`)
  console.log(`  🚫 Rate limited:   ${results.limited > 0 ? red(bold(results.limited)) : gray(results.limited)}`)
  console.log(`  ❌ Errors:         ${results.error > 0 ? red(bold(results.error)) : gray(results.error)}`)
  console.log(`  ⏱ Total time:      ${cyan(elapsed + 's')}`)
  console.log(`  📈 Throughput:     ${cyan((total / parseFloat(elapsed)).toFixed(1) + ' req/s')}`)
  console.log()

  if (results.limited > 0) {
    console.log(green('  ✓ Rate limiting is ACTIVE and working correctly'))
  } else {
    console.log(yellow('  ⚠ No rate limiting was triggered'))
    console.log(gray('    Try increasing --total or check middleware config'))
  }
  console.log()
}

async function main() {
  console.log()
  console.log(bold('═'.repeat(50)))
  console.log(bold(' WhatsApp API — Rate Limit Test'))
  console.log(bold('═'.repeat(50)))
  console.log(`  URL:      ${cyan(BASE_URL + ENDPOINT)}`)
  console.log(`  Mode:     ${blue(MODE)}`)
  console.log(`  Total:    ${TOTAL} requests`)
  console.log(`  Concur:   ${CONCUR} per batch`)
  console.log()

  // Check server is up
  try {
    const health = await fetch(`${BASE_URL}/health`)
    if (!health.ok) throw new Error('Not OK')
    const data = await health.json()
    console.log(green(`  ✓ Server is up — sessions: ${data.sessions}, uptime: ${data.uptime}s\n`))
  } catch {
    console.log(red(`  ✗ Cannot reach server at ${BASE_URL}`))
    console.log(gray('    Make sure the server is running with: npm run dev\n'))
    process.exit(1)
  }

  const startTime = Date.now()
  let results

  if (MODE === 'burst') results = await runBurst()
  else if (MODE === 'gradual') results = await runGradual()
  else if (MODE === 'boundary') results = await runBoundary()
  else {
    console.log(red(`Unknown mode: ${MODE}. Use burst, gradual, or boundary`))
    process.exit(1)
  }

  printSummary(results, startTime)
}

main().catch(err => {
  console.error(red('Fatal error: ' + err.message))
  process.exit(1)
})
