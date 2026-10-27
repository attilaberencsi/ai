// Pure helpers for scripts/check-refs.ts: which external things the registry refers to and how to test each one.

export interface ServerLike {
  name: string
  version?: string
  repository?: { url?: string }
  websiteUrl?: string
  packages?: { registryType: string; identifier: string; version?: string }[]
  remotes?: { url: string }[]
}
export interface SkillLike {
  name: string
  description?: string
  source: string
  ref?: string
  path?: string
  repository?: string
}

export type CheckKind = 'skill' | 'npm' | 'pypi' | 'remote' | 'repo'

export interface Check {
  /** Unique, stable key (also the cache key). */
  key: string
  kind: CheckKind
  /** Who refers to it, e.g. the server or skill name (first referrer wins). */
  label: string
  url: string
  /** Extra data used when judging the response. */
  expect?: { name?: string; description?: string; version?: string }
}

export type Outcome = { status: 'ok' | 'warn' | 'fail' | 'skipped'; detail?: string }

/** Loopback and private-network hosts cannot be checked from here (and are meant to be local). */
export function isLocalUrl(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '::1' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

export const npmUrl = (name: string) => `https://registry.npmjs.org/${name.replace('/', '%2F')}`
export const pypiUrl = (name: string) => `https://pypi.org/pypi/${encodeURIComponent(name)}/json`

/** Raw SKILL.md of a skill; `HEAD` resolves to the default branch when no ref is given. */
export function skillRawUrl(skill: SkillLike): string {
  const path = skill.path ?? `skills/${skill.name}`
  return `https://raw.githubusercontent.com/${skill.source}/${skill.ref ?? 'HEAD'}/${path}/SKILL.md`
}

/** Reads top-level single-line `key: value` pairs from SKILL.md frontmatter (enough for name and description). */
export function parseFrontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return {}
  const out: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line)
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1')
  }
  return out
}

/** How to read the HTTP status of a remote MCP endpoint: any answer except "gone" or a server error means it is alive. */
export function judgeRemoteStatus(status: number): Outcome {
  if (status === 404 || status === 410) return { status: 'fail', detail: `HTTP ${status} (endpoint is gone)` }
  if (status >= 500) return { status: 'warn', detail: `HTTP ${status} (server error)` }
  return { status: 'ok', detail: `HTTP ${status}` }
}

const isGithubRepo = (url: string) => /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url.replace(/\.git$/, ''))

/** Everything the registry depends on, de-duplicated. Local URLs and unsupported package types are returned in `skipped`. */
export function collectChecks(servers: { server: ServerLike }[], skills: { skill: SkillLike }[]): { checks: Check[]; skipped: { label: string; reason: string }[] } {
  const checks = new Map<string, Check>()
  const skipped: { label: string; reason: string }[] = []
  const add = (c: Check) => {
    if (!checks.has(c.key)) checks.set(c.key, c)
  }

  for (const { server: s } of servers) {
    for (const p of s.packages ?? []) {
      if (p.registryType === 'npm') {
        add({ key: `npm:${p.identifier}@${p.version ?? ''}`, kind: 'npm', label: s.name, url: npmUrl(p.identifier), expect: { name: p.identifier, version: p.version } })
      } else if (p.registryType === 'pypi') {
        add({ key: `pypi:${p.identifier}@${p.version ?? ''}`, kind: 'pypi', label: s.name, url: pypiUrl(p.identifier), expect: { name: p.identifier, version: p.version } })
      } else {
        skipped.push({ label: s.name, reason: `${p.registryType} package (${p.identifier}) is not checked` })
      }
    }
    for (const r of s.remotes ?? []) {
      if (isLocalUrl(r.url)) skipped.push({ label: s.name, reason: `local URL ${r.url}` })
      else add({ key: `remote:${r.url}`, kind: 'remote', label: s.name, url: r.url })
    }
    const repo = s.repository?.url
    if (repo && isGithubRepo(repo)) add({ key: `repo:${repo.replace(/\.git$/, '').replace(/\/$/, '')}`, kind: 'repo', label: s.name, url: repo })
  }

  for (const { skill } of skills) {
    const where = `${skill.source}${skill.ref ? '#' + skill.ref : ''}`
    add({ key: `skill:${where}/${skill.name}`, kind: 'skill', label: `${skill.name} (${where})`, url: skillRawUrl(skill), expect: { name: skill.name, description: skill.description } })
    if (skill.repository && isGithubRepo(skill.repository)) add({ key: `repo:${skill.repository.replace(/\/$/, '')}`, kind: 'repo', label: skill.name, url: skill.repository })
  }

  return { checks: [...checks.values()], skipped }
}
