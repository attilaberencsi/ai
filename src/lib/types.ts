// Shapes follow the official MCP registry server.json (schema pinned in registry/schema).
export interface InputBase {
  description?: string
  isRequired?: boolean
  isSecret?: boolean
  default?: string
  value?: string
  placeholder?: string
}
export interface KeyValueInput extends InputBase {
  name: string
}
export interface Argument extends InputBase {
  type: 'positional' | 'named'
  name?: string
  valueHint?: string
}
export interface Package {
  registryType: string
  identifier: string
  version?: string
  runtimeHint?: string
  runtimeArguments?: Argument[]
  packageArguments?: Argument[]
  environmentVariables?: KeyValueInput[]
  transport: { type: 'stdio' }
}
export interface Remote {
  type: 'streamable-http' | 'sse'
  url: string
  headers?: KeyValueInput[]
}
export interface ServerDetail {
  $schema?: string
  name: string
  title?: string
  description: string
  version: string
  websiteUrl?: string
  repository?: { url: string; source?: string; subfolder?: string }
  packages?: Package[]
  remotes?: Remote[]
}

export const CATALOG_KEY = 'io.github.attilaberencsi/catalog'
export interface CatalogMeta {
  category: string
  tags?: string[]
  icon?: string
}
export interface ServerEntry {
  server: ServerDetail
  _meta?: Record<string, unknown> & { [CATALOG_KEY]?: CatalogMeta }
}
