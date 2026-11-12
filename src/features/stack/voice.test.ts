// T5.4 call-outs and the screen wake lock (TASKS.md T5.4; SPEC §3 `/paddle-stack` row, §4 "Paddle Stack rules").
// Acceptance: tests cover the call-out text, voice off, missing `speechSynthesis` and Wake Lock handled without
// errors. English only (the user's call, 2026-11-12). Copy comes from `paddleStack.voice` in src/config/site.ts.
//
// Contract the tests rely on (the plan's names):
// - `callOutText(court, teamA, teamB)` returns `paddleStack.voice.callOut(court, teamA, teamB)`;
// - `canSpeak()` is true only when both `speechSynthesis` and `SpeechSynthesisUtterance` exist;
// - `announce(text)` plays a short chime with Web Audio when `AudioContext` exists, then speaks `text` in English
//   with `speechSynthesis` within 2 s (a timer or the oscillator's `ended` event both work); returns false and
//   does nothing when it can't speak; never throws;
// - `requestWakeLock()` asks `navigator.wakeLock.request('screen')` and resolves to a release function; a no-op
//   release when unsupported or refused; never rejects;
// - `loadVoicePref()` (default false) / `saveVoicePref(on)` in ./storage, never throwing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { STACK_STORAGE_KEY, loadVoicePref, saveVoicePref } from './storage'
import { announce, callOutText, canSpeak, requestWakeLock } from './voice'

const { voice } = paddleStack

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  voice: unknown = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text = '') {
    this.text = text
  }
}

function stubSpeech() {
  const synth = {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
    speaking: false,
    pending: false,
    paused: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return synth
}

/** A minimal Web Audio stub: `stop()` fires the oscillator's `ended` soon after, like a real one. */
function stubAudio() {
  const oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const node = () => ({ connect: vi.fn(function (this: unknown, n: unknown) { return n }), disconnect: vi.fn() })
  class FakeAudioContext {
    currentTime = 0
    state = 'running'
    destination = {}
    createOscillator = vi.fn(() => {
      const listeners: (() => void)[] = []
      const osc = {
        ...node(),
        type: 'sine',
        frequency: param(),
        detune: param(),
        onended: null as null | (() => void),
        addEventListener: vi.fn((_: string, fn: () => void) => listeners.push(fn)),
        removeEventListener: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(() => {
          setTimeout(() => {
            osc.onended?.()
            listeners.forEach((fn) => fn())
          }, 300)
        }),
      }
      oscillators.push(osc)
      return osc
    })
    createGain = vi.fn(() => ({ ...node(), gain: param() }))
    resume = vi.fn(() => Promise.resolve())
    close = vi.fn(() => Promise.resolve())
    suspend = vi.fn(() => Promise.resolve())
  }
  const ctor = vi.fn(function (this: unknown) {
    return new FakeAudioContext()
  })
  vi.stubGlobal('AudioContext', ctor)
  return { ctor, oscillators }
}

function setWakeLock(value: unknown) {
  Object.defineProperty(navigator, 'wakeLock', { value, configurable: true, writable: true })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).wakeLock
})

describe('callOutText (T5.4 call-out text)', () => {
  it('builds the spoken line from paddleStack.voice.callOut', () => {
    expect(callOutText(2, ['Ana', 'Ben'], ['Cora', 'Dan'])).toBe(voice.callOut(2, ['Ana', 'Ben'], ['Cora', 'Dan']))
  })

  it('says the court, then team A and team B, in English', () => {
    expect(callOutText(2, ['Ana', 'Ben'], ['Cora', 'Dan'])).toBe('Court 2: Ana and Ben, versus Cora and Dan.')
  })

  it('handles a two-digit court and names as typed (accents, spaces)', () => {
    expect(callOutText(12, ['José Ma', 'Niño'], ['Ann-Marie', 'Lito'])).toBe(
      'Court 12: José Ma and Niño, versus Ann-Marie and Lito.',
    )
  })

  it('the "Test the voice" sample builds a line with the four sample names', () => {
    const line = callOutText(voice.sample.court, voice.sample.a, voice.sample.b)
    expect(line).toBe(
      `Court ${voice.sample.court}: ${voice.sample.a[0]} and ${voice.sample.a[1]}, versus ${voice.sample.b[0]} and ${voice.sample.b[1]}.`,
    )
  })
})

describe('canSpeak (T5.4 missing speechSynthesis)', () => {
  it('is false when the browser has no speechSynthesis (jsdom by default)', () => {
    expect(canSpeak()).toBe(false)
  })

  it('is true when speechSynthesis and SpeechSynthesisUtterance exist', () => {
    stubSpeech()
    expect(canSpeak()).toBe(true)
  })

  it('is false when speechSynthesis exists but SpeechSynthesisUtterance does not', () => {
    stubSpeech()
    vi.stubGlobal('SpeechSynthesisUtterance', undefined)
    expect(canSpeak()).toBe(false)
  })

  it('is false when SpeechSynthesisUtterance exists but speechSynthesis does not', () => {
    stubSpeech()
    vi.stubGlobal('speechSynthesis', undefined)
    expect(canSpeak()).toBe(false)
  })
})

describe('announce (T5.4 chime, then the call-out)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns false, does not throw and plays no chime when speechSynthesis is missing', async () => {
    const audio = stubAudio()
    let result: boolean | undefined
    expect(() => {
      result = announce('Court 1: Andrew and Juan, versus Maria and Jose.')
    }).not.toThrow()
    expect(result).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(audio.ctor).not.toHaveBeenCalled()
  })

  it('speaks the exact text once, in English, and returns true', async () => {
    const synth = stubSpeech()
    const text = 'Court 1: Andrew and Juan, versus Maria and Jose.'
    expect(announce(text)).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(synth.speak).toHaveBeenCalledTimes(1)
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance).toBeInstanceOf(FakeUtterance)
    expect(utterance.text).toBe(text)
    expect(utterance.lang).toMatch(/^en/)
  })

  it('plays a chime with Web Audio before speaking when AudioContext exists', async () => {
    const synth = stubSpeech()
    const audio = stubAudio()
    expect(announce('Court 2: Ana and Ben, versus Cora and Dan.')).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(audio.ctor).toHaveBeenCalled()
    expect(audio.oscillators.length).toBeGreaterThan(0)
    expect(audio.oscillators[0].start).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    // The chime comes first, then the call-out.
    expect(audio.oscillators[0].start.mock.invocationCallOrder[0]).toBeLessThan(synth.speak.mock.invocationCallOrder[0])
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Court 2: Ana and Ben, versus Cora and Dan.')
  })

  it('still speaks when there is no Web Audio (no chime)', async () => {
    const synth = stubSpeech()
    expect(announce('Court 3: A and B, versus C and D.')).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('still speaks when the AudioContext constructor throws', async () => {
    const synth = stubSpeech()
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        throw new Error('NotAllowedError')
      }),
    )
    expect(() => announce('Court 4: A and B, versus C and D.')).not.toThrow()
    await vi.advanceTimersByTimeAsync(2000)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('never throws when speechSynthesis.speak throws', async () => {
    const synth = stubSpeech()
    synth.speak.mockImplementation(() => {
      throw new Error('synthesis-failed')
    })
    expect(() => announce('Court 1: A and B, versus C and D.')).not.toThrow()
    // A throw inside a timer or promise callback would surface here.
    await vi.advanceTimersByTimeAsync(2000)
    expect(synth.speak).toHaveBeenCalled()
  })
})

describe('requestWakeLock (T5.4 Wake Lock handled without errors)', () => {
  it('asks for a screen wake lock and the release function releases it', async () => {
    const sentinel = { released: false, release: vi.fn(() => Promise.resolve()), addEventListener: vi.fn() }
    const request = vi.fn(() => Promise.resolve(sentinel))
    setWakeLock({ request })
    const release = await requestWakeLock()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('screen')
    expect(typeof release).toBe('function')
    expect(sentinel.release).not.toHaveBeenCalled()
    release()
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('resolves to a no-op release when the Wake Lock API is missing', async () => {
    expect('wakeLock' in navigator).toBe(false)
    const release = await requestWakeLock()
    expect(typeof release).toBe('function')
    expect(() => release()).not.toThrow()
  })

  it('resolves (never rejects) when the browser refuses the lock', async () => {
    setWakeLock({ request: vi.fn(() => Promise.reject(new DOMException('denied', 'NotAllowedError'))) })
    const release = await requestWakeLock()
    expect(typeof release).toBe('function')
    expect(() => release()).not.toThrow()
  })

  it('resolves when request throws synchronously', async () => {
    setWakeLock({
      request: vi.fn(() => {
        throw new TypeError('not supported')
      }),
    })
    await expect(requestWakeLock()).resolves.toBeTypeOf('function')
  })

  it('a release that fails is swallowed (no throw, no unhandled rejection)', async () => {
    const sentinel = { released: false, release: vi.fn(() => Promise.reject(new Error('gone'))), addEventListener: vi.fn() }
    setWakeLock({ request: vi.fn(() => Promise.resolve(sentinel)) })
    const release = await requestWakeLock()
    expect(() => release()).not.toThrow()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })
})

// Node 25's own (file-less) `localStorage` global shadows jsdom's in this test environment and has no methods,
// so each test gets a fresh in-memory Storage. Spies go on the instance.
class MemoryStorage {
  #items = new Map<string, string>()
  get length() {
    return this.#items.size
  }
  key(i: number) {
    return [...this.#items.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.#items.has(k) ? this.#items.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
  clear() {
    this.#items.clear()
  }
}

describe('voice preference (T5.4 voice off by default, the off switch is kept)', () => {
  let storage: MemoryStorage
  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
  })

  it('is off when nothing is saved', () => {
    expect(loadVoicePref()).toBe(false)
  })

  it('keeps "on" and then "off" across loads', () => {
    saveVoicePref(true)
    expect(loadVoicePref()).toBe(true)
    saveVoicePref(false)
    expect(loadVoicePref()).toBe(false)
  })

  it('does not touch the saved session', () => {
    storage.setItem(STACK_STORAGE_KEY, 'session-data')
    saveVoicePref(true)
    expect(storage.getItem(STACK_STORAGE_KEY)).toBe('session-data')
  })

  it('never throws when storage fails, and reads as off', () => {
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => saveVoicePref(true)).not.toThrow()
    expect(loadVoicePref()).toBe(false)
  })
})
