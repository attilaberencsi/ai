import { CATALOG_KEY, type CatalogMeta, type HasCatalog, type ServerEntry } from './types'

export interface Registry {
  servers: ServerEntry[]
}

export const catalogOf = (e: HasCatalog): CatalogMeta => e._meta?.[CATALOG_KEY] ?? { category: 'Other' }

/** Display name used on the card and for sorting. */
export const displayTitle = (e: ServerEntry): string => e.server.title ?? e.server.name.split('/').pop() ?? e.server.name

/** Alphabetical by display title, case-insensitive; does not mutate the input. */
export function sortServers(servers: ServerEntry[]): ServerEntry[] {
  return [...servers].sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), 'en', { sensitivity: 'base', numeric: true }))
}

export async function loadRegistry(url: string): Promise<Registry> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Registry request failed (${res.status})`)
  const data = (await res.json()) as Registry
  if (!Array.isArray(data.servers)) throw new Error('Registry file is malformed: "servers" array missing')
  return { servers: sortServers(data.servers) }
}

/** Categories, alphabetical (so tab order does not depend on which server happens to come first). */
export function categoriesOf(items: HasCatalog[]): string[] {
  return [...new Set(items.map((s) => catalogOf(s).category))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
}

export function inCategory<T extends HasCatalog>(items: T[], category: string | null): T[] {
  return category ? items.filter((s) => catalogOf(s).category === category) : items
}
