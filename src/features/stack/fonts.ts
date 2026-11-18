/**
 * Paddle Stack's own display face (T8.2, the user's pick 2026-11-18): Bricolage Grotesque for names, scores and
 * headings, DM Sans kept for body text. BRAND.md is unchanged: the rest of the site keeps Fraunces and DM Sans, so
 * the stylesheet is added only when the lazy `/paddle-stack` page mounts, never by `index.html`.
 */

/** Google Fonts css2: Bricolage Grotesque 700 and 800, with `font-display: swap` (the Latin subset is split out by unicode-range). */
export const STACK_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap'

/** The display face's family list; `--stack-display` in global.css holds the same list. */
export const STACK_DISPLAY = "'Bricolage Grotesque', 'DM Sans', -apple-system, 'Segoe UI', Roboto, sans-serif"

const MARK = 'data-stack-fonts'

/** Adds the stylesheet link to the head once; later calls do nothing. */
export function loadStackFonts(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector(`link[${MARK}]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = STACK_FONT_URL
  link.setAttribute(MARK, '')
  document.head.appendChild(link)
}
