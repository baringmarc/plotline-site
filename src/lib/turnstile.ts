// Cloudflare Turnstile on the contact form (RESEARCH.md "Turnstile CAPTCHA on the contact form").
// The token goes to the platform's site-contact function, which verifies it with the secret key.

/** Cloudflare's test key that always passes. Its dummy token is refused by real secret keys. */
export const TEST_SITE_KEY = '1x00000000000000000000AA'

/**
 * The site key from VITE_TURNSTILE_SITE_KEY. Until the real key is set, development uses the test key, and a
 * production build gets none: no widget shows and site-contact refuses the form with its own message.
 */
export const turnstileSiteKey: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? TEST_SITE_KEY : '')

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type RenderOptions = {
  sitekey: string
  theme: 'auto' | 'light' | 'dark'
  size: 'normal' | 'flexible' | 'compact'
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}

export type TurnstileApi = {
  render: (el: HTMLElement, options: RenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

/** Loads Cloudflare's script once and resolves with `window.turnstile`. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')))
    script.onerror = () => {
      loading = null
      reject(new Error('Turnstile did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}
