import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, normalizeTheme } from './theme'

describe('themes', () => {
  it('defaults to the green leaf theme', () => {
    expect(DEFAULT_THEME).toBe('leaf')
    expect(THEMES[0].id).toBe('leaf')
  })
  it('keeps the original look available as neon', () => {
    expect(THEMES.map((t) => t.id)).toContain('neon')
  })
  it('has unique theme ids', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
  })
  it('normalizes unknown, empty and missing names to the default', () => {
    expect(normalizeTheme('ocean')).toBe('ocean')
    expect(normalizeTheme('nope')).toBe('leaf')
    expect(normalizeTheme('')).toBe('leaf')
    expect(normalizeTheme(null)).toBe('leaf')
    expect(normalizeTheme(undefined)).toBe('leaf')
  })
})
