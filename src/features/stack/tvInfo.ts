/** What the TV and the board show beside a court: its colour, its last result, a side's win streak (SPEC §6, T8.6). */
import type { Session, Team } from './types'

/** Six court colours (`--court-1` … `--court-6`), cycled: court 7 is tone 1 again. */
export const COURT_TONES = 6

export function courtTone(court: number): number {
  const n = Math.max(1, Math.trunc(court))
  return ((n - 1) % COURT_TONES) + 1
}

/** The latest scored game on this court, winner's score first; null when it has none. */
export function lastResult(session: Session, court: number): { high: number; low: number } | null {
  for (let i = session.games.length - 1; i >= 0; i--) {
    const g = session.games[i]
    if (g.court !== court || g.status !== 'scored' || g.scoreA === undefined || g.scoreB === undefined) continue
    return { high: Math.max(g.scoreA, g.scoreB), low: Math.min(g.scoreA, g.scoreB) }
  }
  return null
}

const sameSide = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id) => b.includes(id))

/**
 * Wins in a row for this exact side: count back through the scored games any of its players played,
 * stopping at the first one where they weren't this side or didn't win. Skipped, cancelled and playing games don't count.
 */
export function teamStreak(session: Session, team: Team): number {
  let streak = 0
  for (let i = session.games.length - 1; i >= 0; i--) {
    const g = session.games[i]
    if (g.status !== 'scored' || g.scoreA === undefined || g.scoreB === undefined) continue
    const ids = [...g.teamA, ...g.teamB]
    if (!team.some((id) => ids.includes(id))) continue
    const won = sameSide(g.teamA, team) ? g.scoreA > g.scoreB : sameSide(g.teamB, team) ? g.scoreB > g.scoreA : false
    if (!won) break
    streak++
  }
  return streak
}
