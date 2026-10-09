import '../styles/theme.css'
import '../styles/landing.css'

// Pointer-follow glow on the section cards (skipped for reduced motion).
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
if (!reduce) {
  document.querySelectorAll<HTMLElement>('.card:not(.disabled)').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--mx', `${e.clientX - r.left}px`)
      card.style.setProperty('--my', `${e.clientY - r.top}px`)
    })
  })
}
