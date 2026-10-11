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
  /** Setup hints shown on the card (prerequisites, add-ons, limits). */
  notes?: string[]
}
export interface ServerEntry {
  server: ServerDetail
  _meta?: Record<string, unknown> & { [CATALOG_KEY]?: CatalogMeta }
}

/** Anything that carries the catalog extension block (servers and skills). */
export interface HasCatalog {
  _meta?: Record<string, unknown> & { [CATALOG_KEY]?: CatalogMeta }
}

/** A skill, modelled on the SKILL.md frontmatter (name, description, license) plus where `npx skills add` finds it. */
export interface Skill {
  name: string
  description: string
  license?: string
  /** Source argument for `npx skills add`, e.g. "owner/repo". */
  source: string
  /** Repository URL (for the "Repository" link). */
  repository: string
  /** Path of the skill inside the repository. */
  path?: string
  /** Page with more information (article, docs). */
  website?: string
}
export interface SkillEntry extends HasCatalog {
  skill: Skill
}
