import { describe, expect, it } from 'vitest'
import { categoriesOf, inCategory, sortServers } from './registry'
import { CATALOG_KEY, type ServerEntry } from './types'

const e = (name: string, category: string, title?: string): ServerEntry => ({
  server: { name, title, description: 'd', version: '1' },
  _meta: { [CATALOG_KEY]: { category } },
})

describe('sortServers', () => {
  const list = [e('a/zeta', 'X'), e('a/b', 'X', 'beta'), e('a/c', 'Y', 'Alpha'), e('a/d', 'Y', 'draw.io MCP')]
  it('sorts alphabetically by display title, ignoring case', () => {
    expect(sortServers(list).map((s) => s.server.name)).toEqual(['a/c', 'a/b', 'a/d', 'a/zeta'])
  })
  it('falls back to the name after the slash when there is no title', () => {
    expect(sortServers([e('a/b', 'X'), e('a/a', 'X')]).map((s) => s.server.name)).toEqual(['a/a', 'a/b'])
  })
  it('does not mutate the input and keeps category filtering order', () => {
    const copy = [...list]
    const sorted = sortServers(list)
    expect(list).toEqual(copy)
    expect(inCategory(sorted, 'Y').map((s) => s.server.name)).toEqual(['a/c', 'a/d'])
    expect(categoriesOf(sorted)).toEqual(['X', 'Y'])
  })
})
