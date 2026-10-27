// Checks that everything the registry refers to still exists: skills (raw SKILL.md at the right repo/branch/path),
// npm and PyPI packages (and pinned versions), public remote MCP endpoints and GitHub repositories.
// Fast by design: one small request per unique reference, run in parallel, successful results cached for 12 hours.
//
//   npm run check:refs              normal run (uses the cache)
//   npm run check:refs -- --refresh ignore the cache and check everything again
//   npm run check:refs -- --registry <dir>  check another folder (always uncached)
//
// Exit code: 0 all fine (warnings allowed), 1 something is gone or wrong, 2 the network could not be reached at all.
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SKILLS_CLI_FLAGS } from '../src/lib/skills'
import { type Check, type Outcome, collectChecks, judgeRemoteStatus, parseFrontmatter } from './refs-lib'

const root = resolve(import.meta.dirname, '..')
const CACHE_FILE = resolve(root, '.cache/check-refs.json')
const TTL_MS = 12 * 60 * 60 * 1000
const CONCURRENCY = 10
const TIMEOUT_MS = 10_000
const refresh = process.argv.includes('--refresh') || process.argv.includes('--no-cache') || process.argv.includes('--registry')

// `--registry <dir>` checks another folder with servers.json and skills.json (for trying the checker out).
const dirArg = process.argv.indexOf('--registry')
const registryDir = dirArg > -1 ? resolve(process.argv[dirArg + 1]) : resolve(root, 'registry')
const servers = JSON.parse(readFileSync(resolve(registryDir, 'servers.json'), 'utf8')).servers
const skills = JSON.parse(readFileSync(resolve(registryDir, 'skills.json'), 'utf8')).skills

type Cache = Record<string, number>
function loadCache(): Cache {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

class NetworkError extends Error {}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
    } catch (e) {
      if (attempt >= 1) throw new NetworkError(e instanceof Error ? (e.cause as Error | undefined)?.message ?? e.message : String(e))
    }
  }
}

async function run(check: Check): Promise<Outcome> {
  try {
    switch (check.kind) {
      case 'skill': {
        const res = await request(check.url)
        if (res.status === 404) return { status: 'fail', detail: `SKILL.md not found (${check.url})` }
        if (!res.ok) return { status: 'warn', detail: `HTTP ${res.status}` }
        const fm = parseFrontmatter(await res.text())
        if (fm.name !== check.expect?.name) return { status: 'fail', detail: `SKILL.md is named "${fm.name ?? '?'}", registry says "${check.expect?.name}"` }
        if (check.expect?.description && fm.description && fm.description !== check.expect.description) {
          return { status: 'warn', detail: 'description changed upstream (update registry/skills.json)' }
        }
        return { status: 'ok' }
      }
      case 'npm': {
        const res = await request(check.url, { headers: { accept: 'application/vnd.npm.install-v1+json' } })
        if (res.status === 404) return { status: 'fail', detail: `npm package "${check.expect?.name}" not found` }
        if (!res.ok) return { status: 'warn', detail: `HTTP ${res.status}` }
        const doc = (await res.json()) as { versions?: Record<string, unknown> }
        const v = check.expect?.version
        if (v && !doc.versions?.[v]) return { status: 'fail', detail: `version ${v} does not exist` }
        return { status: 'ok' }
      }
      case 'pypi': {
        const res = await request(check.url)
        if (res.status === 404) return { status: 'fail', detail: `PyPI package "${check.expect?.name}" not found` }
        if (!res.ok) return { status: 'warn', detail: `HTTP ${res.status}` }
        const doc = (await res.json()) as { releases?: Record<string, unknown> }
        const v = check.expect?.version
        if (v && !doc.releases?.[v]) return { status: 'fail', detail: `version ${v} does not exist` }
        return { status: 'ok' }
      }
      case 'remote': {
        const res = await request(check.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check-refs', version: '1' } } }),
        })
        return judgeRemoteStatus(res.status)
      }
      case 'repo': {
        const res = await request(check.url, { method: 'HEAD' })
        if (res.status === 404) return { status: 'fail', detail: 'repository not found' }
        return res.ok ? { status: 'ok' } : { status: 'warn', detail: `HTTP ${res.status}` }
      }
    }
  } catch (e) {
    if (e instanceof NetworkError) return { status: 'fail', detail: `network error: ${e.message}` }
    throw e
  }
}

/** Runs `worker` over `items` with a fixed number of parallel workers. */
async function pool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i])
      }
    }),
  )
  return results
}

const started = Date.now()
const { checks, skipped } = collectChecks(servers, skills)
const cache = refresh ? {} : loadCache()
const fresh = (c: Check) => cache[c.key] !== undefined && Date.now() - cache[c.key] < TTL_MS
const todo = checks.filter((c) => !fresh(c))
const cached = checks.length - todo.length

const outcomes = await pool(todo, CONCURRENCY, async (c) => ({ c, o: await run(c) }))

const newCache: Cache = {}
for (const c of checks) if (fresh(c)) newCache[c.key] = cache[c.key]
let failures = 0
let warnings = 0
let networkFailures = 0
for (const { c, o } of outcomes) {
  if (o.status === 'ok') newCache[c.key] = Date.now()
  const icon = { ok: '✔', warn: '⚠', fail: '✘', skipped: '·' }[o.status]
  if (o.status === 'fail') {
    failures++
    if (o.detail?.startsWith('network error')) networkFailures++
  }
  if (o.status === 'warn') warnings++
  if (o.status !== 'ok') console.log(`${icon} ${c.kind.padEnd(6)} ${c.label}: ${o.detail ?? ''}\n    ${c.url}`)
}

try {
  if (dirArg === -1) {
    mkdirSync(resolve(root, '.cache'), { recursive: true })
    writeFileSync(CACHE_FILE, JSON.stringify(newCache))
  }
} catch {
  // The cache is an optimisation only.
}

// The install commands on the skills page use flags of `npx skills add`; make sure that CLI still has them.
let cliProblem = false
if (dirArg === -1) {
  try {
    const help = execSync('npx --yes skills add --help', { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'ignore'] })
    const missing = SKILLS_CLI_FLAGS.filter((f) => !help.includes(f))
    if (missing.length) {
      cliProblem = true
      console.log(`✘ cli    skills add: the CLI no longer lists ${missing.join(', ')} (src/lib/skills.ts builds commands with them)`)
    }
  } catch {
    console.log('⚠ cli    could not run `npx skills add --help`; command flags not verified')
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1)
console.log(
  `\nChecked ${checks.length} references in ${secs}s: ${outcomes.length - failures - warnings} ok, ${cached} cached, ${warnings} warnings, ${failures} failed, ${skipped.length} skipped (local or unsupported).`,
)
if (todo.length > 0 && networkFailures === todo.length) {
  console.error('Could not reach the network, so nothing was verified. Check your connection and run again.')
  process.exit(2)
}
if (failures || cliProblem) {
  console.error('Fix or remove the failed references in registry/servers.json and registry/skills.json before pushing.')
  process.exit(1)
}
