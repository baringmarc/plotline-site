/**
 * The head of `/paddle-stack` for search results and link previews (T5.6; formats updated in T8.8). The site is a single-page app, so
 * the Worker (`src/worker.ts`) writes these into `index.html` for that path; `/` keeps index.html's own tags.
 * No amounts here: only `src/config/pricing.ts` sets them.
 */
export const paddleStackMeta = {
  path: '/paddle-stack',
  title: 'Paddle Stack: a free open-play queue for pickleball | Plotline',
  description:
    'Run open play from one phone: singles or doubles, fixed pairs, and six formats including Americano and Mexicano. The courts rotate on their own. Free, no account needed.',
  url: 'https://plotline.fit/paddle-stack',
  image: 'https://plotline.fit/og-paddle-stack.jpg',
  imageAlt: 'Paddle Stack: a free open-play queue for your pickleball group, at plotline.fit/paddle-stack',
}

export type PageMeta = typeof paddleStackMeta
