/**
 * Shares a card (T5.5, kept for T8.7's share cards in ./shareCards): as a file through the phone's share sheet where
 * the browser can, otherwise as a download. Nothing is uploaded.
 */

/**
 * How long a download's object URL stays alive. iOS Safari asks "Download?" and reads the URL only after the tap,
 * so revoking it at once makes Share do nothing there (T8.7 by-eye check, 2026-11-18).
 */
export const DOWNLOAD_URL_LIFETIME_MS = 60_000

/** Shares the image as a file where the browser can (the phone's share sheet), otherwise downloads it. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], fileName, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.canShare === 'function' && typeof nav.share === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled'
      // Any other failure: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS)
  return 'downloaded'
}
