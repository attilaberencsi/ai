export interface Theme {
  id: string
  label: string
  /** Swatch gradient colours (keep in sync with src/styles/theme.css). */
  colors: [string, string]
}

/** The first theme is the default, and it is the one styled on :root in theme.css. */
export const THEMES: Theme[] = [
  { id: 'leaf', label: 'Leaf (green)', colors: ['#4ade80', '#a3e635'] },
  { id: 'neon', label: 'Neon', colors: ['#38e8ff', '#9b6bff'] },
  { id: 'ocean', label: 'Ocean', colors: ['#38bdf8', '#6366f1'] },
  { id: 'ember', label: 'Ember', colors: ['#fb923c', '#f43f5e'] },
]

export const DEFAULT_THEME = THEMES[0].id
export const STORAGE_KEY = 'ai-library-theme'

/** Unknown or missing names fall back to the default (green) theme. */
export function normalizeTheme(id: string | null | undefined): string {
  return THEMES.some((t) => t.id === id) ? (id as string) : DEFAULT_THEME
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // storage blocked: stay on the default theme
  }
}

function save(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Not persisted; the choice still applies until the page is closed.
  }
}

export function applyTheme(id: string) {
  const theme = normalizeTheme(id)
  if (theme === DEFAULT_THEME) delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

/** Renders the swatch buttons into `container` and wires them up. Without this call the site stays green. */
export function initThemePicker(container: HTMLElement | null) {
  if (!container) return
  let current = normalizeTheme(readSaved())
  applyTheme(current)

  container.setAttribute('role', 'group')
  container.setAttribute('aria-label', 'Theme')
  for (const t of THEMES) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'theme-swatch'
    b.title = t.label
    b.setAttribute('aria-label', `${t.label} theme`)
    b.style.background = `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`
    b.dataset.theme = t.id
    b.addEventListener('click', () => {
      current = t.id
      applyTheme(current)
      save(current)
      refresh()
    })
    container.appendChild(b)
  }
  const refresh = () =>
    container.querySelectorAll<HTMLButtonElement>('.theme-swatch').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === current)))
  refresh()
}
