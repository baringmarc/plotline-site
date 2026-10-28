// The pricing model (court-booking-system SAAS-PLAN §1), apart from the rest of the copy so a test can swap it.
// The amount isn't final: every price on the page is built from `bookingFee`, so changing it here changes them all.

export const pricing = {
  currency: '₱',
  /** Per confirmed online booking, paid by the player at checkout. */
  bookingFee: 10,
  /** Never billed, to the venue or the player. The first one is named in the short version. */
  notBilled: ['Open play sessions', 'Blocked-off times', 'Bookings you cancel (the player gets the fee back)'],
}

/** An amount in pesos as the page shows it, e.g. "₱1,500". */
export function peso(amount: number): string {
  return `${pricing.currency}${amount.toLocaleString('en-PH')}`
}
