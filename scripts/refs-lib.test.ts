import { describe, expect, it } from 'vitest'
import { collectChecks, isLocalUrl, judgeRemoteStatus, npmUrl, parseFrontmatter, skillRawUrl } from './refs-lib'

describe('isLocalUrl', () => {
  it('recognises loopback and private hosts', () => {
    for (const u of ['http://localhost:2236/mcp', 'http://127.0.0.1:9/x', 'http://192.168.1.5/mcp', 'http://10.0.0.2/', 'http://my.local/x', 'http://[::1]:80/']) {
      expect(isLocalUrl(u)).toBe(true)
    }
  })
  it('treats public hosts as checkable', () => {
    expect(isLocalUrl('https://mcp.sentry.dev/mcp')).toBe(false)
    expect(isLocalUrl('https://172.217.0.1/')).toBe(false)
  })
})

describe('urls', () => {
  it('encodes scoped npm names', () => {
    expect(npmUrl('@ui5/mcp-server')).toBe('https://registry.npmjs.org/@ui5%2Fmcp-server')
    expect(npmUrl('duckduckgo-mcp-server')).toBe('https://registry.npmjs.org/duckduckgo-mcp-server')
  })
  it('points at the SKILL.md of the right branch and path', () => {
    expect(skillRawUrl({ name: 'cap-mtx', source: 'capire/skills', ref: 'devtoberfest' })).toBe('https://raw.githubusercontent.com/capire/skills/devtoberfest/skills/cap-mtx/SKILL.md')
    expect(skillRawUrl({ name: 'karpathy', source: 'a/b', path: 'x/karpathy' })).toBe('https://raw.githubusercontent.com/a/b/HEAD/x/karpathy/SKILL.md')
  })
})

describe('parseFrontmatter', () => {
  it('reads name and description and ignores nested keys', () => {
    const fm = parseFrontmatter('---\nname: clean-abap\ndescription: "Clean ABAP: apply it."\nmetadata:\n  author: x\n---\n# Body\nname: not-this')
    expect(fm).toEqual({ name: 'clean-abap', description: 'Clean ABAP: apply it.', metadata: '' })
  })
  it('returns nothing without frontmatter', () => {
    expect(parseFrontmatter('# just markdown')).toEqual({})
  })
})

describe('judgeRemoteStatus', () => {
  it('fails on gone endpoints, warns on server errors, accepts auth and method errors', () => {
    expect(judgeRemoteStatus(404).status).toBe('fail')
    expect(judgeRemoteStatus(410).status).toBe('fail')
    expect(judgeRemoteStatus(503).status).toBe('warn')
    for (const s of [200, 202, 400, 401, 403, 405]) expect(judgeRemoteStatus(s).status).toBe('ok')
  })
})

describe('collectChecks', () => {
  const servers = [
    {
      server: {
        name: 'a/one',
        repository: { url: 'https://github.com/o/r' },
        packages: [{ registryType: 'npm', identifier: '@s/p', version: '1.0.0' }, { registryType: 'oci', identifier: 'ghcr.io/x/y' }],
        remotes: [{ url: 'https://mcp.example.com/mcp' }, { url: 'http://localhost:2236/mcp' }],
      },
    },
    { server: { name: 'a/two', repository: { url: 'https://github.com/o/r' }, packages: [{ registryType: 'pypi', identifier: 'pkg' }] } },
  ]
  const skills = [
    { skill: { name: 's1', source: 'o/r', repository: 'https://github.com/o/r' } },
    { skill: { name: 's1', source: 'o/r', ref: 'dev', repository: 'https://github.com/o/r' } },
  ]
  const { checks, skipped } = collectChecks(servers, skills)

  it('creates one check per unique reference', () => {
    expect(checks.map((c) => c.key)).toEqual(['npm:@s/p@1.0.0', 'remote:https://mcp.example.com/mcp', 'repo:https://github.com/o/r', 'pypi:pkg@', 'skill:o/r/s1', 'skill:o/r#dev/s1'])
  })
  it('skips local URLs and unsupported package types', () => {
    expect(skipped.map((s) => s.reason)).toEqual(['oci package (ghcr.io/x/y) is not checked', 'local URL http://localhost:2236/mcp'])
  })
  it('keeps the same skill on different branches apart', () => {
    expect(checks.filter((c) => c.kind === 'skill')).toHaveLength(2)
  })
})
