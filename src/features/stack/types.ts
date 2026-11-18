/** Paddle Stack session types. Rules: SPEC §4 "Paddle Stack rules". */

export type Format = 'fair' | 'winners-split' | 'americano'

/** Singles: one player a side (2 per court). Doubles: two a side (4 per court). Set for the whole session. */
export type Play = 'singles' | 'doubles'

/** Open queue: the board makes the teams. Fixed pairs (doubles only): partners entered together play together all session. */
export type Teams = 'open' | 'fixed'

/** Optional skill level; a player with none fits any group. */
export type Level = 1 | 2 | 3

/** One player a side in singles, two in doubles. */
export type Team = [string] | [string, string]

export type PlayerStatus = 'waiting' | 'playing' | 'out' | 'removed'

export interface Player {
  id: string
  name: string
  status: PlayerStatus
  level?: Level
  /** Fixed pairs only: the partner's player id. */
  partner?: string
}

export type GameStatus = 'playing' | 'scored' | 'skipped' | 'cancelled'

export interface Game {
  id: string
  /** 1-based court number. */
  court: number
  teamA: Team
  teamB: Team
  status: GameStatus
  scoreA?: number
  scoreB?: number
}

export interface Session {
  /** Trimmed, at most 60 characters; '' when there is none. */
  title: string
  play: Play
  teams: Teams
  format: Format
  courts: number
  players: Player[]
  /** Waiting player ids, front of the line first. */
  line: string[]
  /** Every game in the order it went on court. */
  games: Game[]
}

export interface StandingRow {
  playerId: string
  name: string
  place: number
  wins: number
  losses: number
  games: number
  pointsFor: number
  pointsAgainst: number
}
