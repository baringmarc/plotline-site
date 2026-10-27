import { describe, expect, it } from 'vitest'
import { feeComparison, workedExample } from './pricing'

describe('workedExample', () => {
  it('adds the fee on top of the court price and leaves the venue its full price', () => {
    expect(workedExample(400, 2, 10)).toEqual({ courtPrice: 800, fee: 10, playerPays: 810, venueKeeps: 800 })
  })

  it('follows a different fee', () => {
    expect(workedExample(350, 1, 15)).toMatchObject({ playerPays: 365, venueKeeps: 350 })
  })
})

describe('feeComparison', () => {
  it('keeps the flat fee the same at every court price', () => {
    const rows = feeComparison([300, 600, 1200], 10, 5)
    expect(rows.map((r) => r.flat)).toEqual([10, 10, 10])
    expect(rows.map((r) => r.percentage)).toEqual([15, 30, 60])
  })

  it('rounds the percentage to the peso', () => {
    expect(feeComparison([350, 450], 10, 5).map((r) => r.percentage)).toEqual([18, 23])
  })

  it('returns no rows for no prices', () => {
    expect(feeComparison([], 10, 5)).toEqual([])
  })
})
