import { describe, expect, it } from 'vitest'
import { installOptions, launchSpec, shellQuote, shortName } from './install'
import type { ServerDetail } from './types'

const remote: ServerDetail = {
  name: 'io.github.example/hosted-mcp',
  description: 'd',
  version: '1.0.0',
  remotes: [{ type: 'streamable-http', url: 'https://mcp.example.com/mcp', headers: [{ name: 'Authorization', isSecret: true }] }],
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
      environmentVariables: [{ name: 'API_KEY', isSecret: true }],
    },
  ],
}
const get = (s: ServerDetail, id: string) => installOptions(s).find((o) => o.id === id)!

describe('launchSpec', () => {
  it('prefers remotes and uses placeholders for secret headers', () => {
    expect(launchSpec(remote)).toEqual({
      kind: 'remote',
      transport: 'http',
      url: 'https://mcp.example.com/mcp',
      headers: { Authorization: '<AUTHORIZATION>' },
    })
  })
  it('maps npm packages to npx with pinned version and env placeholders', () => {
    expect(launchSpec(npm)).toEqual({ kind: 'stdio', command: 'npx', args: ['-y', '@example/mcp@2.0.0'], env: { API_KEY: '<API_KEY>' } })
  })
  it('returns null for unsupported package types', () => {
    const s = { ...npm, packages: [{ registryType: 'mcpb', identifier: 'x', transport: { type: 'stdio' as const } }] }
    expect(launchSpec(s)).toBeNull()
  })
})

describe('installOptions', () => {
  it('builds a Claude Code command for stdio servers', () => {
    expect(get(npm, 'claude-code').copy).toBe("claude mcp add local-mcp -e 'API_KEY=<API_KEY>' -- npx -y @example/mcp@2.0.0")
  })
  it('builds a Claude Code command for remote servers', () => {
    expect(get(remote, 'claude-code').copy).toBe("claude mcp add --transport http hosted-mcp https://mcp.example.com/mcp --header 'Authorization: <AUTHORIZATION>'")
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

describe('helpers', () => {
  it('shortName takes the part after the slash and sanitizes it', () => {
    expect(shortName({ name: 'io.github.x/My Server!', description: '', version: '1' })).toBe('My-Server')
  })
  it('shellQuote escapes single quotes', () => {
    expect(shellQuote("it's")).toBe(`'it'\\''s'`)
    expect(shellQuote('safe-1.2/x')).toBe('safe-1.2/x')
  })
})
