import { paddleStack } from '../../config/paddleStack'
import type { Format, Play, Teams } from './types'

/** The formats offered for a play and teams choice, in the start screen's order (SPEC §4 "Combinations"). */
export function formatsFor(play: Play, teams: Teams): Format[] {
  return paddleStack.formats
    .map((f) => f.id)
    .filter((id) => {
      if (play === 'singles' && (id === 'winners-split' || teams === 'fixed')) return false
      if (teams === 'fixed' && (id === 'americano' || id === 'mexicano')) return false
      return true
    })
}

/** Fixed pairs: pairs names in list order (1 with 2, 3 with 4); an odd last name is left over. */
export function pairUp(names: string[]): { pairs: [string, string][]; leftover: string | null } {
  const pairs: [string, string][] = []
  for (let i = 0; i + 1 < names.length; i += 2) pairs.push([names[i], names[i + 1]])
  return { pairs, leftover: names.length % 2 ? names[names.length - 1] : null }
}
