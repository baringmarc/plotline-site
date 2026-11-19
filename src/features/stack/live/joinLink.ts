/** The players' link to a live stack (T6.2's share link, T6.6's TV QR). */
export function joinUrl(code: string): string {
  return `${window.location.origin}/paddle-stack/live/${code}`
}

/** The same link without the protocol, short enough to read off a TV. */
export function shortJoinLink(code: string): string {
  return `${window.location.host}/paddle-stack/live/${code}`
}
