import { describe, expect, it } from 'vitest'
import { codexToml, installOptions, installTargets, launchSpec, shellQuote, shortName, type Scope } from './install'
import type { ServerDetail } from './types'

const remote: ServerDetail = {
  name: 'io.github.example/hosted-mcp',
  description: 'd',
  version: '1.0.0',
  remotes: [{ type: 'streamable-http', url: 'https://mcp.example.com/mcp', headers: [{ name: 'Authorization', isSecret: true, isRequired: true }] }],
}
const npm: ServerDetail = {
  name: 'io.github.example/local-mcp',
  description: 'd',
  version: '2.0.0',
  packages: [
    {
      registryType: 'npm',
      identifier: '@example/mcp',
      version: '2.0.0',
      transport: { type: 'stdio' },
      environmentVariables: [{ name: 'API_KEY', isSecret: true, isRequired: true }],
    },
  ],
}
const get = (s: ServerDetail, id: string, scope: Scope = 'user') => installOptions(s, scope).find((o) => o.id === id)!

describe('launchSpec', () => {
  it('prefers remotes and uses placeholders for secret headers', () => {
    expect(launchSpec(remote)).toEqual({
      kind: 'remote',
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: '<AUTHORIZATION>' },
      optional: [],
    })
  })
  it('maps npm packages to npx with pinned version and env placeholders', () => {
    expect(launchSpec(npm)).toEqual({ kind: 'stdio', command: 'npx', args: ['-y', '@example/mcp@2.0.0'], env: { API_KEY: '<API_KEY>' }, optional: [] })
  })
  it('returns null for unsupported package types', () => {
    const s = { ...npm, packages: [{ registryType: 'mcpb', identifier: 'x', transport: { type: 'stdio' as const } }] }
    expect(launchSpec(s)).toBeNull()
  })
})

describe('installOptions', () => {
  it('builds a Claude Code command for stdio servers', () => {
    expect(get(npm, 'claude-code').copy).toBe("claude mcp add local-mcp --scope user -e 'API_KEY=<API_KEY>' -- npx -y @example/mcp@2.0.0")
  })
  it('builds a Claude Code command for remote servers', () => {
    expect(get(remote, 'claude-code').copy).toBe("claude mcp add --transport http --scope user hosted-mcp https://mcp.example.com/mcp --header 'Authorization: <AUTHORIZATION>'")
  })
  it('builds a VS Code deep link carrying URL-encoded JSON with the name', () => {
    const link = get(remote, 'vscode').link!
    expect(link.startsWith('vscode:mcp/install?')).toBe(true)
    const json = JSON.parse(decodeURIComponent(link.split('?')[1]))
    expect(json).toMatchObject({ name: 'hosted-mcp', type: 'http', url: 'https://mcp.example.com/mcp' })
  })
  it('builds a Cursor deep link with base64 config', () => {
    const link = new URL(get(npm, 'cursor').link!)
    expect(link.searchParams.get('name')).toBe('local-mcp')
    const cfg = JSON.parse(atob(link.searchParams.get('config')!))
    expect(cfg).toMatchObject({ command: 'npx', args: ['-y', '@example/mcp@2.0.0'] })
  })
  it('offers the claude.ai connector only for remote servers', () => {
    expect(get(remote, 'claude-ai').link).toContain('connectorUrl=https%3A%2F%2Fmcp.example.com%2Fmcp')
    expect(get(npm, 'claude-ai').unavailable).toBeTruthy()
  })
  it('opens Claude Code with an inert pre-filled prompt', () => {
    const link = get(npm, 'claude-code').link!
    expect(link.startsWith('claude-cli://open?q=')).toBe(true)
    expect(decodeURIComponent(link.split('q=')[1])).toContain('claude mcp add local-mcp')
  })
  it('wraps stdio servers for Claude Desktop config and bridges remotes via mcp-remote', () => {
    expect(JSON.parse(get(npm, 'claude-desktop').copy!).mcpServers['local-mcp'].command).toBe('npx')
    expect(JSON.parse(get(remote, 'claude-desktop').copy!).mcpServers['hosted-mcp'].args).toEqual(['-y', 'mcp-remote', 'https://mcp.example.com/mcp'])
  })
  it('builds Gemini and Codex commands', () => {
    expect(get(remote, 'gemini').copy).toContain('gemini mcp add --transport http')
    expect(get(npm, 'codex').copy).toBe("codex mcp add local-mcp --env 'API_KEY=<API_KEY>' -- npx -y @example/mcp@2.0.0")
  })
  it('marks every client unavailable when nothing is installable', () => {
    const opts = installOptions({ name: 'a/b', description: 'd', version: '1' })
    expect(opts.every((o) => o.unavailable)).toBe(true)
  })
})

describe('optional inputs', () => {
  const withOptional: ServerDetail = {
    name: 'io.github.example/opt-mcp',
    description: 'd',
    version: '1.0.0',
    packages: [
      {
        registryType: 'npm',
        identifier: 'opt-mcp',
        transport: { type: 'stdio' },
        environmentVariables: [
          { name: 'API_KEY', isRequired: true, isSecret: true },
          { name: 'DATA_DIR' },
          { name: 'PORT', default: '9876' },
          { name: 'MODE', value: 'fast' },
        ],
      },
    ],
  }
  it('only puts required or fixed-value variables into the command', () => {
    expect(launchSpec(withOptional)).toMatchObject({ env: { API_KEY: '<API_KEY>', MODE: 'fast' }, optional: ['DATA_DIR', 'PORT'] })
  })
  it('lists the omitted optional variables in the note', () => {
    expect(get(withOptional, 'claude-code').note).toContain('not included: DATA_DIR, PORT')
  })
  it('omits optional headers for remotes (e.g. OAuth-capable servers)', () => {
    const r: ServerDetail = { ...remote, remotes: [{ type: 'streamable-http', url: 'https://x/mcp', headers: [{ name: 'Authorization' }] }] }
    expect(get(r, 'claude-code').copy).toBe('claude mcp add --transport http --scope user hosted-mcp https://x/mcp')
    expect(get(r, 'claude-code').note).toContain('headers not included: Authorization')
  })
})

describe('scopes', () => {
  it('Claude Code supports local, project and user; local is the default and omits the flag', () => {
    expect(get(npm, 'claude-code').scopes).toEqual(['local', 'project', 'user'])
    expect(get(remote, 'claude-code', 'local').copy).toBe("claude mcp add --transport http hosted-mcp https://mcp.example.com/mcp --header 'Authorization: <AUTHORIZATION>'")
    expect(get(remote, 'claude-code', 'project').copy).toContain('--scope project')
    expect(get(remote, 'claude-code', 'project').target).toContain('.mcp.json')
  })
  it('falls back to user scope for clients without the requested scope', () => {
    const o = get(npm, 'vscode', 'local')
    expect(o.scope).toBe('user')
    expect(get(npm, 'claude-desktop', 'project').scope).toBe('user')
  })
  it('VS Code project scope yields a .vscode/mcp.json snippet without a deep link', () => {
    const o = get(remote, 'vscode', 'project')
    expect(o.link).toBeUndefined()
    expect(JSON.parse(o.copy!)).toEqual({
      servers: { 'hosted-mcp': { type: 'http', url: 'https://mcp.example.com/mcp', headers: { Authorization: '<AUTHORIZATION>' } } },
    })
    expect(o.note).toContain('never put real secrets')
  })
  it('Cursor project scope yields an mcp.json snippet; user scope keeps the deep link', () => {
    expect(get(npm, 'cursor', 'project').link).toBeUndefined()
    expect(get(npm, 'cursor', 'project').target).toContain('.cursor/mcp.json')
    expect(get(npm, 'cursor', 'user').link).toContain('cursor://')
  })
  it('Gemini always passes an explicit scope', () => {
    expect(get(remote, 'gemini', 'project').copy).toContain('--scope project')
    expect(get(npm, 'gemini', 'user').copy).toBe("gemini mcp add --scope user -e 'API_KEY=<API_KEY>' local-mcp npx -y @example/mcp@2.0.0")
  })
  it('Codex project scope produces TOML for .codex/config.toml', () => {
    const o = get(npm, 'codex', 'project')
    expect(o.copy).toBe(codexToml('local-mcp', launchSpec(npm)!))
    expect(o.copy).toContain('[mcp_servers.local-mcp]')
    expect(o.copy).toContain('command = "npx"')
    expect(o.copy).toContain('[mcp_servers.local-mcp.env]')
    expect(codexToml('hosted-mcp', launchSpec(remote)!)).toBe('[mcp_servers.hosted-mcp]\nurl = "https://mcp.example.com/mcp"\n')
  })
})

describe('helpers', () => {
  it('shortName takes the part after the slash and sanitizes it', () => {
    expect(shortName({ name: 'io.github.x/My Server!', description: '', version: '1' })).toBe('My-Server')
  })
  it('shortName prefixes generic names with the owner so they stay unique', () => {
    expect(shortName({ name: 'io.github.UI5/mcp-server', description: '', version: '1' })).toBe('ui5-mcp-server')
    expect(shortName({ name: 'io.github.cap-js/mcp-server', description: '', version: '1' })).toBe('cap-js-mcp-server')
  })
  it('shellQuote escapes single quotes', () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(shellQuote('safe-1.2/x')).toBe('safe-1.2/x')
  })
})

describe('Claude Code deep link', () => {
  it('is offered for user scope only, because the link opens the home folder', () => {
    expect(get(npm, 'claude-code', 'user').link).toContain('claude-cli://open?q=')
    expect(get(npm, 'claude-code', 'local').link).toBeUndefined()
    expect(get(npm, 'claude-code', 'project').link).toBeUndefined()
  })
})

describe('installTargets', () => {
  const targets = installTargets(remote)
  it('lists one entry per client+scope with unique keys', () => {
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length)
    expect(targets.map((t) => t.key)).toContain('vscode:user')
    expect(targets.map((t) => t.key)).toContain('claude-code:local')
  })
  it('labels multi-scope clients with their scope and single-scope clients without', () => {
    expect(targets.find((t) => t.key === 'claude-code:project')!.label).toBe('Claude Code · Project')
    expect(targets.find((t) => t.key === 'claude-desktop:user')!.label).toBe('Claude Desktop (config)')
  })
  it('keeps the deep link next to the copy text for the same target', () => {
    const t = targets.find((t) => t.key === 'vscode:user')!
    expect(t.link).toContain('vscode:mcp/install?')
    expect(t.copy).toContain('code --add-mcp')
  })
})
