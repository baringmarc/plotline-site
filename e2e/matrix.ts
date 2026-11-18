// The device matrix for `npm run test:e2e` (TASKS.md, Milestone 8 "Device matrix"). Pure data, so Vitest can check it.

/** Browser engines. WebKit is Safari's engine, not real Safari: the share sheet, photo picker, full screen and wake lock are checked by hand. */
export const engines = ['chromium', 'webkit', 'firefox'] as const

/** Viewports, in CSS pixels. */
export const viewports = {
  phone: { width: 390, height: 844 },
  android: { width: 360, height: 740 },
  'ipad-portrait': { width: 820, height: 1180 },
  'ipad-landscape': { width: 1180, height: 820 },
  laptop: { width: 1366, height: 768 },
  pc: { width: 1920, height: 1080 },
} as const

export const themes = ['light', 'dark'] as const

/** The TV board runs only in the `*-pc` projects (1920×1080). */
export const tvViewport = 'pc'

export type Engine = (typeof engines)[number]
export type ViewportName = keyof typeof viewports
export type Theme = (typeof themes)[number]
