// T8.7 In-app browsers (user, 2026-11-18; SPEC §6 row of that date): "opened inside Messenger, Facebook or Instagram
// (user agent with FBAN, FBAV, FB_IAB or Instagram)" the share dialog warns that the browser can't save or share images.
// `isInAppBrowser(userAgent)` is the detection; real user agents from each app on iOS and Android.
import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from './inApp'

const IN_APP: Record<string, string> = {
  'Messenger on iOS (FBAN)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/437.0.0.33.116;FBBV/545432040;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/0]',
  'Messenger on Android (FB_IAB/Orca)':
    'Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/440.0.0.30.115;]',
  'Facebook on iOS (FBAN/FBIOS)':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/441.0.0.23.105;FBBV/548044578;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
  'Facebook on Android (FB_IAB/FB4A)':
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.231205.015; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/444.0.0.36.118;]',
  'only FBAV in the tag':
    'Mozilla/5.0 (Linux; Android 12; CPH2219 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.5993.111 Mobile Safari/537.36 [FBAV/436.0.0.35.101;]',
  'Instagram on iOS':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 307.0.0.34.111 (iPhone14,2; iOS 17_1; en_US; en; scale=3.00; 1170x2532; 532277016)',
  'Instagram on Android':
    'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android (33/13; 450dpi; 1080x2177; samsung; SM-A536E; a53x; s5e8825; en_US; 541635866)',
}

const BROWSERS: Record<string, string> = {
  'Safari on iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Chrome on iPhone':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  'Chrome on Android':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Firefox on Android': 'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  'Chrome on a Mac':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Safari on a Mac':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Edge on Windows':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Firefox on Windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
}

describe('isInAppBrowser: Messenger, Facebook and Instagram in-app browsers (In-app browsers, user 2026-11-18)', () => {
  for (const [name, ua] of Object.entries(IN_APP)) {
    it(`is true for ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(true)
    })
  }

  for (const [name, ua] of Object.entries(BROWSERS)) {
    it(`is false for ${name}`, () => {
      expect(isInAppBrowser(ua)).toBe(false)
    })
  }

  it('is false for an empty user agent', () => {
    expect(isInAppBrowser('')).toBe(false)
  })
})
