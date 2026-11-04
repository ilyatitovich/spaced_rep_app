const STORAGE_KEY = 'theme'

type ThemePref = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'

function isThemePref(value: string | null): value is ThemePref {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function getThemePref(): ThemePref {
  const stored = localStorage.getItem(STORAGE_KEY)
  return isThemePref(stored) ? stored : 'system'
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  if (pref === 'system') {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyTheme(pref: ThemePref = getThemePref()): ResolvedTheme {
  const resolved = resolveTheme(pref)
  document.documentElement.dataset.theme = resolved

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0f0f0f' : '#f5f5f5')
  }

  return resolved
}

const ICONS: Record<ResolvedTheme, string> = {
  light: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  dark: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
}

class ThemeToggle extends HTMLElement {
  #button: HTMLButtonElement | null = null
  #media: MediaQueryList | null = null

  connectedCallback() {
    if (!this.#button) {
      this.innerHTML = `
        <button
          type="button"
          class="inline-flex size-9 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-muted hover:text-foreground"
        ></button>
      `
      this.#button = this.querySelector('button')
      this.#button?.addEventListener('click', () => this.#toggle())
    }

    this.#media = matchMedia('(prefers-color-scheme: dark)')
    this.#media.addEventListener('change', this.#onSystemChange)
    this.#sync()
  }

  disconnectedCallback() {
    this.#media?.removeEventListener('change', this.#onSystemChange)
  }

  #onSystemChange = () => {
    if (getThemePref() === 'system') this.#sync()
  }

  #toggle() {
    const next: ResolvedTheme =
      resolveTheme(getThemePref()) === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    this.#sync()
  }

  #sync() {
    const resolved = applyTheme()
    if (!this.#button) return
    const label =
      resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    this.#button.setAttribute('aria-label', label)
    this.#button.title = label
    this.#button.innerHTML = ICONS[resolved]
  }
}

if (!customElements.get('theme-toggle')) {
  customElements.define('theme-toggle', ThemeToggle)
}
