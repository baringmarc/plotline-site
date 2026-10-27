// The numbers behind "What it costs". Pure functions of the fee, so the tables follow config/pricing.ts.

export type WorkedExample = {
  courtPrice: number
  fee: number
  /** What the player sends the venue: court price plus the booking fee. */
  playerPays: number
  /** What the venue keeps once the fee is passed on to us: its full court price. */
  venueKeeps: number
}

export function workedExample(ratePerHour: number, hours: number, fee: number): WorkedExample {
  const courtPrice = ratePerHour * hours
  return { courtPrice, fee, playerPays: courtPrice + fee, venueKeeps: courtPrice }
}

export type ComparisonRow = { courtPrice: number; flat: number; percentage: number }

/** Our flat fee next to an illustrative percentage fee, rounded to the peso, at each court price. */
export function feeComparison(courtPrices: number[], fee: number, percent: number): ComparisonRow[] {
  return courtPrices.map((courtPrice) => ({
    courtPrice,
    flat: fee,
    percentage: Math.round((courtPrice * percent) / 100),
  }))
}
