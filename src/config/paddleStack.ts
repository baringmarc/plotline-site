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
  tv: {
    open: 'TV mode',
    exit: 'Exit TV mode',
    /** Opens the TV board in its own window (`?tv=1`) that follows this one. */
    openWindow: 'Open TV in a new window',
    /** The `?tv=1` window's name, so a second click reuses it. */
    windowName: 'paddle-stack-tv',
    court: 'Court',
    /** The banner when a court fills: "Next up on Court 2" (the user's call, 2026-11-12). */
    nowOn: 'Next up on Court',
    vs: 'vs',
    waiting: 'Waiting for 4 players',
    upNext: 'Up next',
    lineEmpty: 'Nobody is waiting',
    footer: 'Paddle Stack · free at plotline.fit/paddle-stack',
  },
  voice: {
    label: 'Call out games',
    hint: 'A chime, then the court and the four names, when a court fills.',
    test: 'Test the voice',
    unsupported: 'This browser can’t speak, so call-outs are off.',
    /** What is said when a court fills (English only, the user's call 2026-11-12). */
    callOut: (court: number, a: [string, string], b: [string, string]) =>
      `Court ${court}: ${a[0]} and ${a[1]}, versus ${b[0]} and ${b[1]}.`,
    sample: { court: 1, a: ['Andrew', 'Juan'] as [string, string], b: ['Maria', 'Jose'] as [string, string] },
  },
  share: {
    button: 'Share standings',
    nameLabel: 'Session name (optional)',
    namePlaceholder: 'e.g. Saturday open play',
    /** The image's heading when no session name is given. */
    defaultTitle: 'Open play standings',
    record: 'W–L',
    diff: '+/−',
    /** "+3 more" under the list when not everyone fits. */
    more: (n: number) => `+${n} more`,
    footer: 'Paddle Stack · free at plotline.fit/paddle-stack',
    fileName: 'paddle-stack-standings.png',
    failed: 'Couldn’t make the image. Try again.',
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
  /** Under the tool (T5.6): how to run open play with it. Format titles match `formats[].label`. */
  guide: {
    title: 'How to run open play with Paddle Stack',
    sections: [
      {
        title: 'Paste your list',
        body: 'Copy the sign-up list from your Reclub or Messenger group and paste it into Players. Numbers like “1.” and repeated names are dropped. Pick how many courts you have and a format, then start the stack. Late arrivals go in with Add players.',
      },
      {
        title: 'Fair rotation',
        body: 'The next four in line take the open court, and when their game ends all four go to the back of the line. Everyone plays about the same number of games, whoever wins.',
      },
      {
        title: 'Winners stay, split up',
        body: 'The winners keep the court but play against each other, each with a new partner from the line. After two wins in a row they go off too, so nobody holds a court all night.',
      },
      {
        title: 'Americano',
        body: 'Games are played in rounds, with a new partner every game for as long as the numbers allow. Each player keeps their own wins, losses and points, so the standings show who did best on their own.',
      },
      {
        title: 'Put the courts on a TV',
        body: 'Connect a laptop or tablet to a TV facing the courts and use TV mode, or open the TV board in a new window and keep scoring in this one. Turn on call-outs and the device announces each court and its four names.',
      },
    ],
  },
  faq: {
    title: 'Questions organizers ask',
    items: [
      {
        q: 'Is it free? Do players need an account?',
        a: 'It’s free, and nobody needs an account or an app. Only the organizer uses it; players just watch the board or listen for their names.',
      },
      {
        q: 'Where is my session saved?',
        a: 'In this browser on this device. A refresh or a closed tab picks up where you left off. Nothing is sent to us.',
      },
      {
        q: 'Can I run it from more than one phone?',
        a: 'Not yet. One device runs the session; a TV window on the same device follows it.',
      },
      {
        q: 'What if someone takes a break or leaves early?',
        a: 'Tap Time out and they skip their turns until you put them back in line. Remove takes them off the list and out of the standings.',
      },
    ],
  },
}
