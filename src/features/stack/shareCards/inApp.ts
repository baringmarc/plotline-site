/**
 * Messenger, Facebook and Instagram open links in their own browser, which blocks downloads and Web Share, so a share
 * card can't leave it (T8.7, the user's call 2026-11-18). Their user agents carry FBAN, FBAV or FB_IAB (Facebook's apps,
 * Messenger included) or Instagram.
 */
const IN_APP = /FBAN|FBAV|FB_IAB|Instagram/

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP.test(userAgent)
}
