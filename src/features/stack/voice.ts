/**
 * Call-outs and the screen wake lock for Paddle Stack. Browser APIs may be missing (no speech, no Web Audio, no
 * Wake Lock): nothing here throws, and missing features are skipped quietly.
 */
import { paddleStack } from '../../config/paddleStack'

/** "Court 2: Ana and Ben, versus Cora and Dan." English only (the user's call, 2026-11-12). */
export function callOutText(court: number, teamA: [string, string], teamB: [string, string]): string {
  return paddleStack.voice.callOut(court, teamA, teamB)
}

export function canSpeak(): boolean {
  return typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined'
}

/** How long after the chime starts the voice begins. */
const CHIME_MS = 650

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.95
    speechSynthesis.speak(u)
  } catch {
    // A speech engine that refuses is the same as none.
  }
}

/** Two short rising tones. Returns false when Web Audio is missing or fails. */
function chime(): boolean {
  const AudioCtx =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return false
  try {
    const ctx = new AudioCtx()
    const t = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
    gain.connect(ctx.destination)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, t)
    osc.frequency.setValueAtTime(880, t + 0.22)
    osc.connect(gain)
    osc.start(t)
    osc.stop(t + 0.55)
    osc.onended = () => {
      void ctx.close?.()?.catch?.(() => {})
    }
    return true
  } catch {
    return false
  }
}

/** Plays the chime, then speaks `text`. False (and silent) when the browser can't speak. */
export function announce(text: string): boolean {
  if (!canSpeak()) return false
  if (chime()) setTimeout(() => speak(text), CHIME_MS)
  else speak(text)
  return true
}

/** Keeps the screen on while TV mode is open. Resolves to a release function; a no-op one when unsupported or refused. */
export async function requestWakeLock(): Promise<() => void> {
  const noop = () => {}
  try {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    if (!wakeLock?.request) return noop
    const sentinel = await wakeLock.request('screen')
    let released = false
    return () => {
      if (released) return
      released = true
      try {
        void Promise.resolve(sentinel.release()).catch(() => {})
      } catch {
        // Already released by the browser.
      }
    }
  } catch {
    return noop
  }
}
