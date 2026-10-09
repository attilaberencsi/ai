import { CATALOG_KEY, type CatalogMeta, type ServerEntry } from './types'

export interface Registry {
  servers: ServerEntry[]
}

export const catalogOf = (e: ServerEntry): CatalogMeta => e._meta?.[CATALOG_KEY] ?? { category: 'Other' }

export async function loadRegistry(url: string): Promise<Registry> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Registry request failed (${res.status})`)
  const data = (await res.json()) as Registry
  if (!Array.isArray(data.servers)) throw new Error('Registry file is malformed: "servers" array missing')
  return data
}

/** Categories in first-seen order. */
export function categoriesOf(servers: ServerEntry[]): string[] {
  return [...new Set(servers.map((s) => catalogOf(s).category))]
}

export function inCategory(servers: ServerEntry[], category: string | null): ServerEntry[] {
  return category ? servers.filter((s) => catalogOf(s).category === category) : servers
}
