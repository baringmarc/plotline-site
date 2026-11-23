import { paddleStack } from '../../config/paddleStack'
import { createSession, locksOffered, StackError, type NewPlayer } from './engine'
import type { Format, Play, Session } from './types'

/** The formats offered for a play choice, in the start screen's order (SPEC §4 "Combinations"). */
export function formatsFor(play: Play): Format[] {
  return paddleStack.formats.map((f) => f.id).filter((id) => !(play === 'singles' && id === 'winners-split'))
}

const nameOf = (p: NewPlayer) => (typeof p === 'string' ? p : p.name)
const key = (name: string) => name.trim().toLocaleLowerCase()

/**
 * The session the start screen starts (SPEC §4 "Pair locks"): the players join in list order and each pair, given by
 * name (ignoring case), is then locked, standing at its further-back partner's spot. Pairs are ignored where locks
 * aren't offered. A Round Robin with pairs must pair everyone (`needs-pair`).
 */
export function startSession(opts: {
  title: string
  play: Play
  format: Format
  courts: number
  players: NewPlayer[]
  pairs: [string, string][]
}): Session {
  const { title, play, format, courts, players } = opts
  const position = new Map(players.map((p, i) => [key(nameOf(p)), i]))
  // Usable pairs: two different listed names, each in one pair only; partners in list order.
  const used = new Set<string>()
  const pairs: [number, number][] = []
  if (locksOffered(play, format)) {
    for (const [a, b] of opts.pairs) {
      const [ka, kb] = [key(a), key(b)]
      const [ia, ib] = [position.get(ka), position.get(kb)]
      if (ia === undefined || ib === undefined || ka === kb || used.has(ka) || used.has(kb)) continue
      used.add(ka)
      used.add(kb)
      pairs.push(ia < ib ? [ia, ib] : [ib, ia])
    }
  }

  if (format === 'round-robin' && pairs.length && used.size !== position.size) {
    throw new StackError('needs-pair', 'Round Robin is all pairs or no pairs')
  }
  const name = (i: number) => nameOf(players[i])
  return createSession({ title, play, format, courts, names: players, locks: pairs.map(([a, b]) => [name(a), name(b)]) })
}
