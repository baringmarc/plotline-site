/**
 * Share card backgrounds (T8.7, SPEC §6 "T8.7 plan gate"): four drawn on the canvas in brand tones (no image files),
 * or the organizer's own photo under a darkness shade. The photo is decoded on the device and never uploaded.
 */

import { paddleStack } from '../../../config/paddleStack'

export interface BuiltinBackground {
  id: string
  label: string
}

/** Drawn in drawCard.ts (`paintBuiltin`); the first is the default. */
export const BACKGROUNDS: BuiltinBackground[] = (['clay', 'night', 'sunset', 'sand'] as const).map((id) => ({
  id,
  label: paddleStack.share.backgrounds[id],
}))

export type CardBackground = { kind: 'builtin'; id: string } | { kind: 'photo'; image: CanvasImageSource }

/** The slider's starting point: dark enough that white text reads on a bright photo. */
export const DEFAULT_DARKNESS = 50

/** The shade's alpha over a photo for darkness 0–100 (clamped): 0 is the photo as it is, 100 is 0.85. */
export function overlayAlpha(darkness: number): number {
  const d = Math.min(100, Math.max(0, Number.isNaN(darkness) ? 0 : darkness))
  return (d / 100) * 0.85
}

/** Decodes a picked photo on the device; nothing is sent anywhere. */
export async function loadPhoto(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // Fall through to an <img>, which some browsers decode where createImageBitmap can't (e.g. HEIC on Safari).
    }
  }
  // A blob: URL is local (no request). It stays alive with the <img>, which redraws from it.
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
  return img
}

/** Frees a photo from `loadPhoto` once it's replaced or the dialog closes: closes a bitmap, revokes an <img>'s blob URL. */
export function releasePhoto(image: CanvasImageSource): void {
  const bitmap = image as { close?: () => void }
  if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap && typeof bitmap.close === 'function') {
    bitmap.close()
    return
  }
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement && image.src.startsWith('blob:')) {
    URL.revokeObjectURL(image.src)
  }
}
