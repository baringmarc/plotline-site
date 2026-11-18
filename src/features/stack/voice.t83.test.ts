// T8.3 call-outs for singles courts (TASKS.md T8.3: "the board, TV, call-outs and share image show singles courts
// correctly (one name a side)"). Copy from `paddleStack.voice`.
//
// Contract (the plan's names): `callOutText(court, teamA: string[], teamB: string[])` returns
// `paddleStack.voice.callOut(court, a, b)`; doubles stays "Court 2: Ana and Ben, versus Cora and Dan.", singles is
// "Court 1: Ana, versus Ben.".
import { describe, expect, it } from 'vitest'
import { paddleStack } from '../../config/site'
import { callOutText } from './voice'

const { voice } = paddleStack

describe('callOutText for singles (T8.3)', () => {
  it('says one name a side: "Court 1: Ana, versus Ben."', () => {
    expect(callOutText(1, ['Ana'], ['Ben'])).toBe('Court 1: Ana, versus Ben.')
  })

  it('handles a two-digit court and names as typed', () => {
    expect(callOutText(12, ['José Ma'], ['Niño'])).toBe('Court 12: José Ma, versus Niño.')
  })

  it('reads from paddleStack.voice.callOut for singles too', () => {
    expect(callOutText(3, ['Ana'], ['Ben'])).toBe(voice.callOut(3, ['Ana'], ['Ben']))
  })

  it('never says "and" with one player a side', () => {
    expect(callOutText(1, ['Ana'], ['Ben'])).not.toMatch(/\band\b/)
  })
})

describe('callOutText for doubles stays as it was (T8.3)', () => {
  it('"Court 2: Ana and Ben, versus Cora and Dan."', () => {
    expect(callOutText(2, ['Ana', 'Ben'], ['Cora', 'Dan'])).toBe('Court 2: Ana and Ben, versus Cora and Dan.')
    expect(voice.callOut(2, ['Ana', 'Ben'], ['Cora', 'Dan'])).toBe('Court 2: Ana and Ben, versus Cora and Dan.')
  })
})
