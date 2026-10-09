import type { Argument, KeyValueInput, Package, Remote, ServerDetail } from './types'

/** Normalized way to launch/connect a server, independent of any client. */
export type LaunchSpec =
  | { kind: 'stdio'; command: string; args: string[]; env: Record<string, string> }
  | { kind: 'remote'; transport: 'http' | 'sse'; url: string; headers: Record<string, string> }

export interface InstallOption {
  id: string
  label: string
  /** Text copied to the clipboard (command or config snippet). */
  copy?: string
  /** URL opened in a new tab / handed to the OS URL handler. */
  link?: string
  linkLabel?: string
  note?: string
  /** Reason when this client cannot install the server. */
  unavailable?: string
}

const CLIENTS: [id: string, label: string][] = [
  ['vscode', 'VS Code'],
  ['vscode-insiders', 'VS Code Insiders'],
  ['cursor', 'Cursor'],
  ['claude-code', 'Claude Code'],
  ['claude-ai', 'Claude (connector)'],
  ['claude-desktop', 'Claude Desktop (config)'],
  ['gemini', 'Gemini CLI'],
  ['codex', 'Codex CLI'],
]

const PLACEHOLDER_NOTE = 'Replace <PLACEHOLDER> values with your own credentials before running.'

const placeholder = (name: string) => `<${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}>`

function inputValue(i: KeyValueInput): string {
  return i.value ?? i.default ?? placeholder(i.name)
}

function argTokens(args: Argument[] = []): string[] {
  return args.flatMap((a) => {
    const v = a.value ?? a.default
    if (a.type === 'named' && a.name) {
      if (v === undefined) return a.isRequired ? [a.name, `<${a.valueHint ?? a.name.replace(/^-+/, '')}>`] : []
      return [a.name, v]
    }
    return [v ?? `<${a.valueHint ?? 'value'}>`]
  })
}

function packageSpec(p: Package): LaunchSpec | null {
  const env = Object.fromEntries((p.environmentVariables ?? []).map((e) => [e.name, inputValue(e)]))
  const runtime = argTokens(p.runtimeArguments)
  const pkgArgs = argTokens(p.packageArguments)
  switch (p.registryType) {
    case 'npm': {
      const id = p.version ? `${p.identifier}@${p.version}` : p.identifier
      return { kind: 'stdio', command: p.runtimeHint ?? 'npx', args: ['-y', ...runtime, id, ...pkgArgs], env }
    }
    case 'pypi': {
      const id = p.version ? `${p.identifier}==${p.version}` : p.identifier
      return { kind: 'stdio', command: p.runtimeHint ?? 'uvx', args: [...runtime, id, ...pkgArgs], env }
    }
    case 'oci': {
      const image = p.version && !p.identifier.includes(':') ? `${p.identifier}:${p.version}` : p.identifier
      const envFlags = Object.keys(env).flatMap((k) => ['-e', k])
      return { kind: 'stdio', command: 'docker', args: ['run', '-i', '--rm', ...envFlags, ...runtime, image, ...pkgArgs], env }
    }
    default:
      return null
  }
}

function remoteSpec(r: Remote): LaunchSpec {
  const headers = Object.fromEntries((r.headers ?? []).map((h) => [h.name, inputValue(h)]))
  return { kind: 'remote', transport: r.type === 'sse' ? 'sse' : 'http', url: r.url, headers }
}

/** Prefer a hosted remote (no local runtime needed), else the first supported package. */
export function launchSpec(server: ServerDetail): LaunchSpec | null {
  const remote = server.remotes?.find((r) => r.type === 'streamable-http') ?? server.remotes?.[0]
  if (remote) return remoteSpec(remote)
  for (const p of server.packages ?? []) {
    const spec = packageSpec(p)
    if (spec) return spec
  }
  return null
}

/** Short CLI-safe name from the reverse-DNS registry name, e.g. io.github.x/foo-mcp -> foo-mcp. */
export function shortName(server: ServerDetail): string {
  const last = server.name.split('/').pop() ?? server.name
  return last.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp-server'
}

/** POSIX single-quote unless the token is plainly safe. Placeholders like <TOKEN> get quoted. */
export function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`
}
const sh = (tokens: string[]) => tokens.map(shellQuote).join(' ')

const hasEntries = (o: Record<string, string>) => Object.keys(o).length > 0
const headerFlags = (h: Record<string, string>) => Object.entries(h).flatMap(([k, v]) => ['--header', `${k}: ${v}`])
const envFlags = (flag: string, env: Record<string, string>) => Object.entries(env).flatMap(([k, v]) => [flag, `${k}=${v}`])

/** mcp.json-style entry (without the name). */
function clientConfig(spec: LaunchSpec) {
  if (spec.kind === 'remote') return { url: spec.url, ...(hasEntries(spec.headers) ? { headers: spec.headers } : {}) }
  return { command: spec.command, args: spec.args, ...(hasEntries(spec.env) ? { env: spec.env } : {}) }
}

function vscodeConfig(name: string, spec: LaunchSpec) {
  if (spec.kind === 'remote') {
    return { name, type: spec.transport, url: spec.url, ...(hasEntries(spec.headers) ? { headers: spec.headers } : {}) }
  }
  return { name, type: 'stdio', command: spec.command, args: spec.args, ...(hasEntries(spec.env) ? { env: spec.env } : {}) }
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

function claudeCodeCommand(name: string, spec: LaunchSpec): string {
  if (spec.kind === 'remote') {
    return sh(['claude', 'mcp', 'add', '--transport', spec.transport, name, spec.url, ...headerFlags(spec.headers)])
  }
  return sh(['claude', 'mcp', 'add', name, ...envFlags('-e', spec.env), '--', spec.command, ...spec.args])
}

function geminiCommand(name: string, spec: LaunchSpec): string {
  if (spec.kind === 'remote') {
    return sh(['gemini', 'mcp', 'add', '--transport', spec.transport, ...headerFlags(spec.headers), name, spec.url])
  }
  return sh(['gemini', 'mcp', 'add', ...envFlags('-e', spec.env), name, spec.command, ...spec.args])
}

function codexCommand(name: string, spec: LaunchSpec): string {
  if (spec.kind === 'remote') return sh(['codex', 'mcp', 'add', name, '--url', spec.url])
  return sh(['codex', 'mcp', 'add', name, ...envFlags('--env', spec.env), '--', spec.command, ...spec.args])
}

/** All install options for a server, in display order (see CLIENTS). */
export function installOptions(server: ServerDetail): InstallOption[] {
  const spec = launchSpec(server)
  if (!spec) {
    const why = 'No supported remote or package (npm, pypi, oci) found for this server.'
    return CLIENTS.map(([id, label]) => ({ id, label, unavailable: why }))
  }
  const name = shortName(server)
  const needsCreds = spec.kind === 'stdio' ? hasEntries(spec.env) : hasEntries(spec.headers)
  const note = needsCreds ? PLACEHOLDER_NOTE : undefined
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ') || undefined

  const vsc = JSON.stringify(vscodeConfig(name, spec))
  const vscCli = `--add-mcp "${vsc.replace(/"/g, '\\"')}"`
  const mcpJson = JSON.stringify({ mcpServers: { [name]: clientConfig(spec) } }, null, 2)
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(b64(JSON.stringify(clientConfig(spec))))}`
  const claudeCmd = claudeCodeCommand(name, spec)
  const claudePrompt = `Add this MCP server to my Claude Code setup by running: ${claudeCmd}`

  const claudeAi: InstallOption =
    spec.kind === 'remote'
      ? {
          id: 'claude-ai',
          label: '',
          copy: spec.url,
          link: `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(name)}&connectorUrl=${encodeURIComponent(spec.url)}`,
          linkLabel: 'Add to Claude',
          note: 'Opens claude.ai Add custom connector. Prefill is unofficial - if fields are empty, paste the copied URL.',
        }
    : {
          id: 'claude-ai',
          label: '',
          unavailable: 'Connectors need a remote (URL) server; this one runs locally. Use Claude Code or Claude Desktop (config).',
        }

  const desktopEntry = spec.kind === 'remote' ? { command: 'npx', args: ['-y', 'mcp-remote', spec.url] } : clientConfig(spec)

  const byId: Record<string, Omit<InstallOption, 'id' | 'label'>> = {
    vscode: { copy: `code ${vscCli}`, link: `vscode:mcp/install?${encodeURIComponent(vsc)}`, linkLabel: 'Install in VS Code', note },
    'vscode-insiders': {
      copy: `code-insiders ${vscCli}`,
      link: `vscode-insiders:mcp/install?${encodeURIComponent(vsc)}`,
      linkLabel: 'Install in VS Code Insiders',
      note,
    },
    cursor: { copy: mcpJson, link: cursorLink, linkLabel: 'Install in Cursor', note: join('Copy gives an mcp.json snippet.', note) },
    'claude-code': {
      copy: claudeCmd,
      link: `claude-cli://open?q=${encodeURIComponent(claudePrompt)}`,
      linkLabel: 'Open in Claude Code',
      note: join('"Open" starts a Claude Code session with the prompt pre-filled (not sent); needs Claude Code used once on this machine.', note),
    },
    'claude-ai': claudeAi,
    'claude-desktop': {
      copy: JSON.stringify({ mcpServers: { [name]: desktopEntry } }, null, 2),
      note: join(
        'Merge into claude_desktop_config.json (Settings > Developer > Edit Config), then restart.',
        spec.kind === 'remote' ? 'Remote servers are bridged via mcp-remote; the claude.ai connector is preferred.' : undefined,
        note,
      ),
    },
    gemini: { copy: geminiCommand(name, spec), note },
    codex: { copy: codexCommand(name, spec), note },
  }
  return CLIENTS.map(([id, label]) => ({ ...byId[id], id, label }))
}
