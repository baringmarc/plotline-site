// T5.3 paste parsing: one name per line or comma-separated; "1." numbering and duplicates are ignored,
// so a Reclub or Messenger list pastes as is.
import { describe, expect, it } from 'vitest'
import { parseNames } from './parseNames'

describe('parseNames (T5.3 paste box)', () => {
  it('splits one name per line', () => {
    expect(parseNames('Andrew\nMaria\nJuan\nJose')).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('splits comma-separated names', () => {
    expect(parseNames('Andrew, Maria,Juan ,  Jose')).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('mixes lines and commas', () => {
    expect(parseNames('Andrew, Maria\nJuan\nJose, Ana')).toEqual(['Andrew', 'Maria', 'Juan', 'Jose', 'Ana'])
  })

  it('handles Windows line endings', () => {
    expect(parseNames('Andrew\r\nMaria\r\n')).toEqual(['Andrew', 'Maria'])
  })

  it('ignores "1." numbering, with or without a space, and two-digit numbers', () => {
    expect(parseNames('1. Andrew\n2.Maria\n10. Juan\n 11.  Jose')).toEqual(['Andrew', 'Maria', 'Juan', 'Jose'])
  })

  it('keeps numbers that are part of a name (not leading "N.")', () => {
    expect(parseNames('Juan 2\nMaria B.')).toEqual(['Juan 2', 'Maria B.'])
  })

  it('pastes a Reclub/Messenger-style numbered list as is', () => {
    const list = '1. Andrew\n2. Maria\n3. Juan\n4. Jose\n5. Ana\n'
    expect(parseNames(list)).toEqual(['Andrew', 'Maria', 'Juan', 'Jose', 'Ana'])
  })

  it('ignores duplicates ignoring case, keeping the first spelling and order', () => {
    expect(parseNames('Andrew\nmaria\nANDREW\n Maria \nJuan')).toEqual(['Andrew', 'maria', 'Juan'])
  })

  it('ignores duplicates that differ only by their numbering', () => {
    expect(parseNames('1. Andrew\n2. Maria\n3. andrew')).toEqual(['Andrew', 'Maria'])
  })

  it('trims names and skips blank lines and empty comma slots', () => {
    expect(parseNames('  Andrew  \n\n\n , ,Maria,\n   \n')).toEqual(['Andrew', 'Maria'])
  })

  it('skips a line that is only a number', () => {
    expect(parseNames('1.\n2. Maria\n3. ')).toEqual(['Maria'])
  })

  it('returns an empty list for empty or blank text', () => {
    expect(parseNames('')).toEqual([])
    expect(parseNames('   \n , \n')).toEqual([])
  })
})
