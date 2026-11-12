/** Paddle Stack session types. Rules: SPEC §4 "Paddle Stack rules". */

export type Format = 'fair' | 'winners-split' | 'americano'

export type PlayerStatus = 'waiting' | 'playing' | 'out' | 'removed'

export interface Player {
  id: string
  name: string
  status: PlayerStatus
}

export type GameStatus = 'playing' | 'scored' | 'skipped' | 'cancelled'

export interface Game {
  id: string
  /** 1-based court number. */
  court: number
  teamA: [string, string]
  teamB: [string, string]
  status: GameStatus
  scoreA?: number
  scoreB?: number
}

export interface Session {
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
