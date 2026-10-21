import type { Argument, KeyValueInput, Package, Remote, ServerDetail } from './types'

/** Normalized way to launch/connect a server, independent of any client. */
export type LaunchSpec =
  | { kind: 'stdio'; command: string; args: string[]; env: Record<string, string>; optional: string[] }
  | { kind: 'remote'; transport: 'http' | 'sse'; url: string; headers: Record<string, string>; optional: string[] }

/** user = all your projects; project = shared via the repo; local = this project only, private (Claude Code). */
export type Scope = 'user' | 'project' | 'local'

export const SCOPE_LABELS: Record<Scope, string> = {
  user: 'User (all projects)',
  project: 'Project (shared in repo)',
  local: 'Local (this project, private)',
}

export const SCOPE_SHORT: Record<Scope, string> = { user: 'User', project: 'Project', local: 'Local' }

export interface InstallOption {
  id: string
  /** Unique per client+scope; set by installTargets. */
  key?: string
  label: string
  /** Scopes this client can install into. */
  scopes: Scope[]
  /** Scope actually used (the requested one, or the client's fallback when unsupported). */
  scope: Scope
  /** Where the server ends up, e.g. a config file. */
  target?: string
  /** Text copied to the clipboard (command or config snippet). */
  copy?: string
  /** URL opened in a new tab / handed to the OS URL handler. */
  link?: string
  linkLabel?: string
  note?: string
  /** Reason when this client cannot install the server. */
  unavailable?: string
}

const CLIENTS: [id: string, label: string, scopes: Scope[]][] = [
  ['vscode', 'VS Code', ['user', 'project']],
  ['vscode-insiders', 'VS Code Insiders', ['user', 'project']],
  ['cursor', 'Cursor', ['user', 'project']],
  ['claude-code', 'Claude Code', ['local', 'project', 'user']],
  ['claude-ai', 'Claude Web (connector)', ['user']],
  ['claude-desktop', 'Claude Desktop (config)', ['user']],
  ['gemini', 'Gemini CLI', ['user', 'project']],
  ['codex', 'Codex CLI', ['user', 'project']],
]

const PLACEHOLDER_NOTE = 'Replace only the <PLACEHOLDER> parts with your own credentials and keep the text around them (e.g. the word "Bearer " before a token).'

const placeholder = (name: string) => `<${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}>`

function inputValue(i: KeyValueInput): string {
  return i.value ?? i.default ?? placeholder(i.name)
}

/** Required inputs (and ones with a fixed value) go into the command; the rest are only listed in a note. */
function splitInputs(inputs: KeyValueInput[] = []) {
  const used = inputs.filter((i) => i.isRequired || i.value !== undefined)
  const optional = inputs.filter((i) => !used.includes(i)).map((i) => i.name)
  return { values: Object.fromEntries(used.map((i) => [i.name, inputValue(i)])), optional }
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
  const { values: env, optional } = splitInputs(p.environmentVariables)
  const runtime = argTokens(p.runtimeArguments)
  const pkgArgs = argTokens(p.packageArguments)
  switch (p.registryType) {
    case 'npm': {
      const id = p.version ? `${p.identifier}@${p.version}` : p.identifier
      return { kind: 'stdio', command: p.runtimeHint ?? 'npx', args: ['-y', ...runtime, id, ...pkgArgs], env, optional }
    }
    case 'pypi': {
      const id = p.version ? `${p.identifier}==${p.version}` : p.identifier
      return { kind: 'stdio', command: p.runtimeHint ?? 'uvx', args: [...runtime, id, ...pkgArgs], env, optional }
    }
    case 'oci': {
      const image = p.version && !p.identifier.includes(':') ? `${p.identifier}:${p.version}` : p.identifier
      const envFlags = Object.keys(env).flatMap((k) => ['-e', k])
      return { kind: 'stdio', command: 'docker', args: ['run', '-i', '--rm', ...envFlags, ...runtime, image, ...pkgArgs], env, optional }
    }
    default:
      return null
  }
}

function remoteSpec(r: Remote): LaunchSpec {
  const { values: headers, optional } = splitInputs(r.headers)
  return { kind: 'remote', transport: r.type === 'sse' ? 'sse' : 'http', url: r.url, headers, optional }
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

const GENERIC_NAMES = new Set(['mcp', 'server', 'mcp-server', 'mcp_server'])

/** Short CLI-safe name from the reverse-DNS registry name, e.g. io.github.x/foo-mcp -> foo-mcp. */
export function shortName(server: ServerDetail): string {
  const [namespace, last = namespace] = server.name.split('/')
  // Generic names (e.g. "mcp-server") would clash across servers, so prefix them with the owner.
  const owner = namespace.split('.').pop() ?? ''
  const base = GENERIC_NAMES.has(last.toLowerCase()) && owner ? `${owner.toLowerCase()}-${last}` : last
  return base.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'mcp-server'
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

/** VS Code server entry (without the name). */
function vscodeEntry(spec: LaunchSpec) {
  if (spec.kind === 'remote') {
    return { type: spec.transport, url: spec.url, ...(hasEntries(spec.headers) ? { headers: spec.headers } : {}) }
  }
  return { type: 'stdio', command: spec.command, args: spec.args, ...(hasEntries(spec.env) ? { env: spec.env } : {}) }
}

/**
 * Claude Desktop only starts local (stdio) servers, so remote ones go through the mcp-remote bridge.
 * Headers use ${VAR} placeholders filled from `env` (the documented workaround for spaces in args on Windows);
 * plain http:// URLs need --allow-http.
 */
function mcpRemoteEntry(spec: Extract<LaunchSpec, { kind: 'remote' }>) {
  const env: Record<string, string> = {}
  const headerArgs = Object.entries(spec.headers).flatMap(([header, value]) => {
    const variable = `${header.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_HEADER`
    env[variable] = value
    return ['--header', `${header}:\${${variable}}`]
  })
  return {
    command: 'npx',
    args: ['-y', 'mcp-remote', spec.url, ...(spec.url.startsWith('http://') ? ['--allow-http'] : []), ...headerArgs],
    ...(hasEntries(env) ? { env } : {}),
  }
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

// Claude Code's default scope is local, so the flag is only emitted for project/user.
function claudeCodeCommand(name: string, spec: LaunchSpec, scope: Scope): string {
  const scopeFlag = scope === 'local' ? [] : ['--scope', scope]
  if (spec.kind === 'remote') {
    return sh(['claude', 'mcp', 'add', '--transport', spec.transport, ...scopeFlag, name, spec.url, ...headerFlags(spec.headers)])
  }
  return sh(['claude', 'mcp', 'add', name, ...scopeFlag, ...envFlags('-e', spec.env), '--', spec.command, ...spec.args])
}

// Gemini CLI defaults to project scope, so the scope is always explicit.
function geminiCommand(name: string, spec: LaunchSpec, scope: Scope): string {
  const scopeFlag = ['--scope', scope]
  if (spec.kind === 'remote') {
    return sh(['gemini', 'mcp', 'add', '--transport', spec.transport, ...scopeFlag, ...headerFlags(spec.headers), name, spec.url])
  }
  return sh(['gemini', 'mcp', 'add', ...scopeFlag, ...envFlags('-e', spec.env), name, spec.command, ...spec.args])
}

const BEARER = /^Bearer\s/i

/** Codex reads a bearer token from an environment variable; returns its name when the server needs an Authorization: Bearer header. */
function codexTokenEnvVar(name: string, spec: LaunchSpec): string | undefined {
  if (spec.kind !== 'remote') return undefined
  const auth = Object.entries(spec.headers).find(([k, v]) => k.toLowerCase() === 'authorization' && BEARER.test(v))
  return auth ? `${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_TOKEN` : undefined
}

function codexCommand(name: string, spec: LaunchSpec): string {
  if (spec.kind === 'remote') {
    const tokenVar = codexTokenEnvVar(name, spec)
    return sh(['codex', 'mcp', 'add', name, '--url', spec.url, ...(tokenVar ? ['--bearer-token-env-var', tokenVar] : [])])
  }
  return sh(['codex', 'mcp', 'add', name, ...envFlags('--env', spec.env), '--', spec.command, ...spec.args])
}

const tomlStr = (s: string) => JSON.stringify(s)

/** Codex config.toml table for a server (used for the project-scoped .codex/config.toml). */
export function codexToml(name: string, spec: LaunchSpec): string {
  const key = /^[A-Za-z0-9_-]+$/.test(name) ? name : tomlStr(name)
  if (spec.kind === 'remote') {
    const tokenVar = codexTokenEnvVar(name, spec)
    return `[mcp_servers.${key}]\nurl = ${tomlStr(spec.url)}\n${tokenVar ? `bearer_token_env_var = ${tomlStr(tokenVar)}\n` : ''}`
  }
  const lines = [`[mcp_servers.${key}]`, `command = ${tomlStr(spec.command)}`, `args = [${spec.args.map(tomlStr).join(', ')}]`]
  if (hasEntries(spec.env)) {
    lines.push('', `[mcp_servers.${key}.env]`, ...Object.entries(spec.env).map(([k, v]) => `${k} = ${tomlStr(v)}`))
  }
  return lines.join('\n') + '\n'
}

/** The scope a client actually uses: the requested one if supported, else its most sensible fallback. */
function effectiveScope(scopes: Scope[], requested: Scope): Scope {
  if (scopes.includes(requested)) return requested
  return scopes.includes('user') ? 'user' : scopes[0]
}

/** All install options for a server, in display order (see CLIENTS), for the requested scope. */
export function installOptions(server: ServerDetail, requested: Scope = 'user'): InstallOption[] {
  const spec = launchSpec(server)
  if (!spec) {
    const why = 'No supported remote or package (npm, pypi, oci) found for this server.'
    return CLIENTS.map(([id, label, scopes]) => ({ id, label, scopes, scope: effectiveScope(scopes, requested), unavailable: why }))
  }
  const name = shortName(server)
  const needsCreds = spec.kind === 'stdio' ? hasEntries(spec.env) : hasEntries(spec.headers)
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ') || undefined
  const optionalNote = spec.optional.length
    ? `Optional ${spec.kind === 'remote' ? 'headers' : 'environment variables'} not included: ${spec.optional.join(', ')}.`
    : undefined
  const credNote = (scope: Scope) =>
    join(
      !needsCreds ? undefined : scope === 'project' ? `${PLACEHOLDER_NOTE} This file is committed to your repo: never put real secrets in it.` : PLACEHOLDER_NOTE,
      optionalNote,
    )

  const entry = vscodeEntry(spec)
  const vscJson = JSON.stringify({ name, ...entry })
  const vscCli = `--add-mcp "${vscJson.replace(/"/g, '\\"')}"`
  const vscWorkspace = JSON.stringify({ servers: { [name]: entry } }, null, 2)
  const mcpJson = JSON.stringify({ mcpServers: { [name]: clientConfig(spec) } }, null, 2)
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(b64(JSON.stringify(clientConfig(spec))))}`
  const desktopEntry = spec.kind === 'remote' ? mcpRemoteEntry(spec) : clientConfig(spec)

  const build = (id: string, scope: Scope): Omit<InstallOption, 'id' | 'label' | 'scopes' | 'scope'> => {
    const note = credNote(scope)
    switch (id) {
      case 'vscode':
      case 'vscode-insiders': {
        const bin = id === 'vscode' ? 'code' : 'code-insiders'
        const proto = id === 'vscode' ? 'vscode' : 'vscode-insiders'
        const label = id === 'vscode' ? 'VS Code' : 'VS Code Insiders'
        if (scope === 'project') {
          return { copy: vscWorkspace, target: '.vscode/mcp.json in your workspace', note: join('Create or merge into this file.', note) }
        }
        return {
          copy: `${bin} ${vscCli}`,
          link: `${proto}:mcp/install?${encodeURIComponent(vscJson)}`,
          linkLabel: `Install in ${label}`,
          target: `${label} user profile (all workspaces)`,
          note,
        }
      }
      case 'cursor':
        return scope === 'project'
          ? { copy: mcpJson, target: '.cursor/mcp.json in your project', note: join('Create or merge into this file.', note) }
          : { copy: mcpJson, link: cursorLink, linkLabel: 'Install in Cursor', target: '~/.cursor/mcp.json (all projects)', note: join('Copy gives an mcp.json snippet.', note) }
      case 'claude-code': {
        const cmd = claudeCodeCommand(name, spec, scope)
        const target = { local: '~/.claude.json, stored under the path of the folder you run it in (only that project, private to you)', project: '.mcp.json in the project root (shared via git)', user: '~/.claude.json, top-level (available in all your projects)' }[scope]
        // The deep link always opens Claude Code in the home folder, so it is only right for user scope:
        // local/project scope belong to a specific project folder, where the copied command must be run.
        if (scope !== 'user') {
          return {
            copy: cmd,
            target,
            note: join('Run this in a terminal inside the project this server is for (the deep link would open your home folder instead).', note),
          }
        }
        return {
          copy: cmd,
          link: `claude-cli://open?q=${encodeURIComponent(`Add this MCP server to my Claude Code setup by running: ${cmd}`)}`,
          linkLabel: 'Prefill in Claude Code',
          target,
          note: join(
            'Opens Claude Code in your home folder with the command pre-filled; you must trust that folder on first use, press Enter and approve the command. Or use Copy and run it in any terminal.',
            note,
          ),
        }
      }
      case 'claude-ai':
        return spec.kind === 'remote'
          ? {
              copy: spec.url,
              link: `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodeURIComponent(name)}&connectorUrl=${encodeURIComponent(spec.url)}`,
              linkLabel: 'Add to Claude',
              target: 'your Claude account',
              note: 'Opens claude.ai Add custom connector. Prefill is unofficial - if fields are empty, paste the copied URL.',
            }
          : { unavailable: 'Connectors need a remote (URL) server; this one runs locally. Use Claude Code or Claude Desktop (config).' }
      case 'claude-desktop':
        return {
          copy: JSON.stringify({ mcpServers: { [name]: desktopEntry } }, null, 2),
          target: 'claude_desktop_config.json (Open Settings > Developer > Edit Config)',
          note: join(
            'Merge into the file, then restart Claude Desktop.',
            spec.kind === 'remote' ? 'Remote servers are bridged via mcp-remote; the claude.ai connector is preferred.' : undefined,
            note,
          ),
        }
      case 'gemini':
        return {
          copy: geminiCommand(name, spec, scope),
          target: scope === 'project' ? '.gemini/settings.json in the project' : '~/.gemini/settings.json (all projects)',
          note,
        }
      default: { // codex
        const tokenVar = codexTokenEnvVar(name, spec)
        const codexNote = join(
          tokenVar ? `Set the environment variable ${tokenVar} to your token (without the "Bearer " prefix) before starting Codex.` : undefined,
          spec.kind === 'remote' && Object.keys(spec.headers).some((k) => k.toLowerCase() !== 'authorization')
            ? 'Codex cannot set other custom headers from this command; add them to config.toml by hand.'
            : undefined,
          note,
        )
        return scope === 'project'
          ? { copy: codexToml(name, spec), target: '.codex/config.toml in the project (trusted projects only)', note: join('Create or merge into this file.', codexNote) }
          : { copy: codexCommand(name, spec), target: '~/.codex/config.toml (all projects)', note: codexNote }
      }
    }
  }

  return CLIENTS.map(([id, label, scopes]) => {
    const scope = effectiveScope(scopes, requested)
    return { id, label, scopes, scope, ...build(id, scope) }
  })
}

/** One entry per (client, scope) pair, labelled "Client - Scope" for clients with several scopes. */
export function installTargets(server: ServerDetail): InstallOption[] {
  return CLIENTS.flatMap(([id, , scopes]) =>
    scopes.map((scope) => {
      const o = installOptions(server, scope).find((x) => x.id === id)!
      return { ...o, key: `${id}:${scope}`, label: scopes.length > 1 ? `${o.label} · ${SCOPE_SHORT[scope]}` : o.label }
    }),
  )
}
