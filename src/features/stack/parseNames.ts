/**
 * Turns pasted text into player names: one per line or comma-separated. A leading "1." is dropped, so a list
 * copied from Reclub or Messenger pastes as is; blank items, bare numbers and repeated names (ignoring case,
 * the first spelling wins) are skipped.
 */
export function parseNames(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/\r?\n|,/)) {
    const name = raw.trim().replace(/^\d+\.\s*/, '').trim()
    if (!name || /^\d+$/.test(name)) continue
    const key = name.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}
