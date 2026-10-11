import { ref } from 'vue'

/** Copies text to the clipboard (with a fallback for insecure contexts) and exposes a short-lived `copied` flag. */
export function useClipboard(resetMs = 1800) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Fallback for non-secure contexts / denied permission.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), resetMs)
  }

  return { copied, copy }
}
