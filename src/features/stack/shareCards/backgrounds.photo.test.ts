// T8.7 Share cards: the organizer's photo is decoded on the device and freed when done (TASKS.md T8.7: "the photo never
// leaves the device"; reviewer round 2: `loadPhoto` / `releasePhoto` need their own tests).
//
// Contract (backgrounds.ts):
// - `loadPhoto(file)`: `createImageBitmap(file)` when it exists; if that rejects (e.g. HEIC on Safari) or is missing,
//   decodes through an `<img>` whose src is a local `URL.createObjectURL(file)`; if `img.decode()` rejects, that URL is
//   revoked and the promise rejects. Never fetches.
// - `releasePhoto(image)`: closes an ImageBitmap; revokes an HTMLImageElement's `blob:` src; leaves anything else alone.
//
// jsdom has no createImageBitmap, no ImageBitmap and no HTMLImageElement.prototype.decode, so each test stubs them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPhoto, releasePhoto } from './backgrounds'

const BLOB_URL = 'blob:http://localhost/photo-1'

/** Stands in for the browser's ImageBitmap so `instanceof ImageBitmap` holds. */
class FakeBitmap {
  width = 1200
  height = 1600
  close = vi.fn()
}

let decode: ReturnType<typeof vi.fn>
let fetchSpy: ReturnType<typeof vi.fn>
const hadDecode = Object.prototype.hasOwnProperty.call(HTMLImageElement.prototype, 'decode')
const originalDecode = (HTMLImageElement.prototype as { decode?: unknown }).decode

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => BLOB_URL), configurable: true, writable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  decode = vi.fn(() => Promise.resolve())
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: decode, configurable: true, writable: true })
  fetchSpy = vi.fn(() => Promise.reject(new Error('no network in tests')))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (hadDecode) Object.defineProperty(HTMLImageElement.prototype, 'decode', { value: originalDecode, configurable: true, writable: true })
  else delete (HTMLImageElement.prototype as { decode?: unknown }).decode
})

const photo = () => new File(['jpeg-bytes'], 'court.jpg', { type: 'image/jpeg' })

describe('loadPhoto: decodes the picked photo on the device', () => {
  it('uses createImageBitmap(file) when the browser has it, without a blob URL or an <img>', async () => {
    const bitmap = new FakeBitmap()
    const create = vi.fn(() => Promise.resolve(bitmap))
    vi.stubGlobal('createImageBitmap', create)
    const file = photo()
    const result = await loadPhoto(file)
    expect(result).toBe(bitmap)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(file)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to an <img> from a local blob: URL when createImageBitmap rejects (e.g. HEIC on Safari)', async () => {
    const create = vi.fn(() => Promise.reject(new DOMException('The source image could not be decoded.', 'InvalidStateError')))
    vi.stubGlobal('createImageBitmap', create)
    const file = new File(['heic-bytes'], 'court.heic', { type: 'image/heic' })
    const result = await loadPhoto(file)
    expect(create).toHaveBeenCalledWith(file)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(result).toBeInstanceOf(HTMLImageElement)
    expect((result as HTMLImageElement).src).toBe(BLOB_URL)
    expect(decode).toHaveBeenCalledTimes(1)
    // The <img> redraws from the URL, so it stays alive until releasePhoto.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('decodes through an <img> from a local blob: URL when createImageBitmap is missing', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const file = photo()
    const result = await loadPhoto(file)
    expect(URL.createObjectURL).toHaveBeenCalledWith(file)
    expect(result).toBeInstanceOf(HTMLImageElement)
    expect((result as HTMLImageElement).src).toBe(BLOB_URL)
    expect((result as HTMLImageElement).src.startsWith('blob:')).toBe(true)
    expect(decode).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('revokes the blob: URL and rejects when the <img> can’t decode the file either', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.reject(new Error('unsupported'))))
    const err = new DOMException('The source image cannot be decoded.', 'EncodingError')
    decode.mockImplementation(() => Promise.reject(err))
    await expect(loadPhoto(photo())).rejects.toBe(err)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects and revokes when createImageBitmap is missing and the <img> can’t decode', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    decode.mockImplementation(() => Promise.reject(new Error('bad image')))
    await expect(loadPhoto(photo())).rejects.toThrow('bad image')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL)
  })

  it('makes no network request on any path (fetch or XHR)', async () => {
    const xhrOpen = vi.spyOn(XMLHttpRequest.prototype, 'open')
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve(new FakeBitmap())))
    await loadPhoto(photo())
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.reject(new Error('heic'))))
    await loadPhoto(photo())
    decode.mockImplementation(() => Promise.reject(new Error('bad')))
    await loadPhoto(photo()).catch(() => {})
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrOpen).not.toHaveBeenCalled()
  })
})

describe('releasePhoto: frees a photo once it is replaced or the dialog closes', () => {
  it('closes an ImageBitmap and revokes nothing', () => {
    vi.stubGlobal('ImageBitmap', FakeBitmap)
    const bitmap = new FakeBitmap()
    releasePhoto(bitmap as unknown as CanvasImageSource)
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes the blob: src of an <img> from loadPhoto', () => {
    const img = new Image()
    img.src = BLOB_URL
    releasePhoto(img)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL)
  })

  it('frees the <img> that loadPhoto returned on the fallback path', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    const img = await loadPhoto(photo())
    releasePhoto(img)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(BLOB_URL)
  })

  it('leaves an <img> with a non-blob src alone', () => {
    const img = new Image()
    img.src = 'https://example.com/court.jpg'
    expect(() => releasePhoto(img)).not.toThrow()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('leaves anything else alone: no throw, no revoke, no close', () => {
    vi.stubGlobal('ImageBitmap', FakeBitmap)
    const canvas = document.createElement('canvas')
    expect(() => releasePhoto(canvas)).not.toThrow()
    // Has a close() but is not an ImageBitmap: not called.
    const lookalike = { width: 10, height: 10, close: vi.fn() }
    expect(() => releasePhoto(lookalike as unknown as CanvasImageSource)).not.toThrow()
    expect(lookalike.close).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('does not throw where the browser has no ImageBitmap at all', () => {
    vi.stubGlobal('ImageBitmap', undefined)
    const lookalike = { width: 10, height: 10, close: vi.fn() }
    expect(() => releasePhoto(lookalike as unknown as CanvasImageSource)).not.toThrow()
    expect(lookalike.close).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})
