// Paddle Stack copy, re-exported by ./site (CLAUDE.md: visitor-facing copy lives in src/config/site.ts and its modules).
/**
 * Paddle Stack (`/paddle-stack`, Milestone 5): a free open-play queue for organizers. It runs on one
 * device and is a site tool, not a feature of the booking product (SPEC §3.1 "Feature claims").
 */
export const paddleStack = {
  title: 'Paddle Stack',
  lead: 'A free open-play queue. Paste your players, pick a format, and the courts rotate on their own. No sign-up, nothing to install.',
  start: {
    courtsLabel: 'Courts',
    formatLabel: 'Format',
    namesLabel: 'Players',
    namesHint: 'One per line, or separated by commas. A list copied from Reclub or Messenger works as is: numbers like “1.” are ignored, and so are repeated names.',
    namesPlaceholder: '1. Andrew\n2. Maria\n3. Juan\n4. Jose',
    needFour: 'Add at least 4 players to start.',
    submit: 'Start the stack',
  },
  formats: [
    {
      id: 'fair',
      label: 'Fair rotation',
      description: 'The classic paddle stack: the next 4 in line take the court, then go to the back.',
    },
    {
      id: 'winners-split',
      label: 'Winners stay, split up',
      description: 'Winners keep the court but split up, each with a new partner from the line. Two wins in a row and everyone goes off.',
    },
    {
      id: 'americano',
      label: 'Americano',
      description: 'A new partner every game, in rounds. Everyone keeps their own wins, losses and points.',
    },
  ],
  board: {
    court: 'Court',
    waiting: 'Waiting for 4 players',
    vs: 'vs',
    enterScore: 'Enter score',
    skipScore: 'Skip score',
    saveScore: 'Save score',
    cancel: 'Cancel',
    scoreFor: 'Score for',
    tie: 'A game can’t end in a tie.',
    badScore: 'Scores are whole numbers from 0 to 99.',
    upNext: 'Up next',
    lineEmpty: 'Nobody is waiting.',
    timeOut: 'Time out',
    remove: 'Remove',
    onBreak: 'On a time out',
    backInLine: 'Back in line',
    addLabel: 'Add players',
    addSubmit: 'Add',
    roundWait: 'The next round starts when every court is done.',
  },
  standings: {
    title: 'Standings',
    empty: 'No scores yet.',
    place: '#',
    player: 'Player',
    wins: 'W',
    losses: 'L',
    diff: '+/−',
  },
  end: {
    button: 'End session',
    confirm: 'End this session? The final standings stay on screen.',
    yes: 'Yes, end it',
    no: 'Keep playing',
  },
  ended: {
    title: 'Final standings',
    again: 'Start a new session',
  },
  restart: 'Start over',
  restartConfirm: 'Start over? This clears the players and scores.',
  storageNote: 'This browser can’t save the session, so keep this tab open until you’re done.',
  venueCta: {
    title: 'Run a venue?',
    body: 'Plotline gives your venue its own booking page, free. Players book and pay you directly.',
    link: 'Get your venue online',
    /** The landing page's contact form (`contactAnchor` in ./site; not imported, to keep this module out of the first load). */
    href: '/#contact',
  },
}
