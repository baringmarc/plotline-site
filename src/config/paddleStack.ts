import type { Format } from '../features/stack/types'

// Paddle Stack copy, re-exported by ./site (CLAUDE.md: visitor-facing copy lives in src/config/site.ts and its modules).
/**
 * Paddle Stack (`/paddle-stack`, Milestone 5): a free open-play queue for organizers. It runs on one
 * device and is a site tool, not a feature of the booking product (SPEC §3.1 "Feature claims").
 */
export const paddleStack = {
  title: 'Paddle Stack',
  lead: 'A free open-play queue. Paste your players, pick a format, and the courts rotate on their own. No sign-up, nothing to install.',
  start: {
    titleLabel: 'Game title (optional)',
    titlePlaceholder: 'e.g. Sunday Open Play (ALL LEVELS)',
    playLabel: 'Play',
    plays: [
      { id: 'singles', label: 'Singles' },
      { id: 'doubles', label: 'Doubles' },
    ] as { id: 'singles' | 'doubles'; label: string }[],
    courtsLabel: 'Courts',
    /** The format radio group's legend. */
    formatLabel: 'Rotation',
    namesLabel: 'Players',
    namesHint: 'One per line, or separated by commas. A list copied from Reclub or Messenger works as is: numbers like “1.” are ignored, and so are repeated names.',
    namesPlaceholder: '1. Andrew\n2. Maria\n3. Juan\n4. Jose',
    /** Heading over the name chips. */
    playersLabel: 'Who’s playing',
    levelFor: (name: string) => `Level for ${name}`,
    noLevel: 'Any level',
    levels: [
      { value: 1, label: 'Beginner' },
      { value: 2, label: 'Intermediate' },
      { value: 3, label: 'Advanced' },
    ] as { value: 1 | 2 | 3; label: string }[],
    /** The partner picker on a name chip (T8.9), and its empty first option. */
    pairWith: (name: string) => `Pair ${name} with…`,
    pairPlaceholder: 'Pair with…',
    pairsHint: 'To lock two players as a pair, pick a partner on a name. A pair always plays together, as one team; everyone else gets new teams from the line.',
    unlock: 'Unlock',
    needFour: 'Add at least 4 players to start.',
    needTwo: 'Add at least 2 players to start.',
    needAllPairs: 'Round Robin is played all in pairs or with no pairs. Pair everyone, or unlock the pairs.',
    submit: 'Start the stack',
  },
  /** Order matters: the start screen shows them in this order, the left column then the right (the user's order, 2026-11-18). Each has a one-line hint, a badge and a longer explanation. */
  formats: [
    {
      id: 'fair',
      column: 'left',
      label: 'Fair rotation',
      badge: 'Fair matching',
      hint: 'The next in line take the court, then go to the back.',
      details: 'The players waiting longest take the free court: in doubles the next four, 1st and 3rd against 2nd and 4th; in singles the next two. When the game ends, everyone in it goes to the back of the line, so everyone plays about the same number of games, whoever wins.',
    },
    {
      id: 'americano',
      column: 'left',
      label: 'Americano (Round Robin)',
      badge: 'New partners',
      hint: 'A new partner every game, in rounds.',
      details: 'Games are played in rounds. Each round the players with the fewest games go on, with partners they haven’t had yet, so over the night everyone partners as many people as the numbers allow. Everyone keeps their own wins, losses and points. In singles it’s a new opponent every game. Partners change every game, so pairs can’t be locked.',
    },
    {
      id: 'winners-split',
      column: 'left',
      label: 'Winners stay, split up',
      badge: 'Competitive',
      hint: 'Winners keep the court but split up, each with a new partner.',
      details: 'The winners stay on and play against each other, each with a new partner from the front of the line; the losers go to the back. Two wins in a row and all four go off, so nobody holds a court all night. A locked pair that wins stays together and plays the next team. Doubles only.',
    },
    {
      id: 'mexicano',
      column: 'right',
      label: 'Mexicano',
      badge: 'Score matching',
      hint: 'Rounds matched by the standings, so games stay close.',
      details: 'Games are played in rounds. The first round is matched by skill level where you set one; after that, by the live standings. In each group of four, 1st and 4th play 2nd and 3rd; in singles, 1st plays 2nd. Partners change every round, so pairs can’t be locked.',
    },
    {
      id: 'winners-losers',
      column: 'right',
      label: 'Winners vs Losers',
      badge: 'Competitive',
      hint: 'Winners play winners, losers play losers.',
      details: 'After each game the winners line up to play other winners, and the losers other losers. New players fit either side. If there aren’t enough of one, the court takes whoever has waited longest.',
    },
    {
      id: 'skill-groups',
      column: 'right',
      label: 'Skill groups',
      badge: 'Skill matching',
      hint: 'The next game is players of the same level.',
      details: 'The player waiting longest goes on next, with the next players in line at the same level. Players with no level fit any group. If the line can’t make a group at one level, the court takes the front of the line, so nobody waits forever. Set the levels on the names above.',
    },
  ] as {
    id: Format
    column: 'left' | 'right'
    label: string
    badge: string
    hint: string
    details: string
  }[],
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
    /** Pair locks on the board (T8.9): the picker on a waiting player, and Unlock on a pair. */
    pairWith: (name: string) => `Pair ${name} with…`,
    pairPlaceholder: 'Pair with…',
    unlock: 'Unlock',
    /** A Round Robin played in pairs takes late arrivals as a pair. */
    addPairLabel: 'Add a pair',
    addPairFirst: 'First player',
    addPairSecond: 'Second player',
    addPairSubmit: 'Add pair',
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
    waitingSingles: 'Waiting for 2 players',
    upNext: 'Up next',
    lineEmpty: 'Nobody is waiting',
    /** Players on a time out, under Up next (T8.6). */
    onBreak: 'On a break:',
    /** The wordmark beside the logo tile, lowercase like the site's (T8.6). */
    brand: 'plotline',
    /** A court's last scored game, winner's score first (T8.6). */
    lastGame: (high: number, low: number) => `Last game ${high}–${low}`,
    /** Beside a side that won its last games together (from 2; T8.6). Also on the board's court cards. */
    streak: (n: number) => `${n} wins in a row`,
    footer: 'Paddle Stack · free at plotline.fit/paddle-stack',
    /** The join QR in the bottom band while the stack is live (T6.6). */
    join: {
      title: 'Follow on your phone',
      qrLabel: 'QR code to follow this board on your phone',
    },
  },
  voice: {
    label: 'Call out games',
    hint: 'A chime, then the court and the names, when a court fills.',
    test: 'Test the voice',
    unsupported: 'This browser can’t speak, so call-outs are off.',
    /** What is said when a court fills (English only, the user's call 2026-11-12). */
    callOut: (court: number, a: string[], b: string[]) => `Court ${court}: ${a.join(' and ')}, versus ${b.join(' and ')}.`,
    sample: { court: 1, a: ['Andrew', 'Juan'] as [string, string], b: ['Maria', 'Jose'] as [string, string] },
  },
  share: {
    button: 'Share standings',
    /** The image's heading when the session has no title. */
    defaultTitle: 'Open play standings',
    record: 'W–L',
    diff: '+/−',
    /** The link on both share cards, bottom right (T8.7c). */
    footer: 'plotline.fit/paddle-stack',
    failed: 'Couldn’t make the image. Try again.',
    /** Share cards (T8.7): "Share card" on each standings row, with the player's name for screen readers. */
    cardButton: 'Share card',
    cardButtonFor: (name: string) => `Share card for ${name}`,
    dialogTitle: 'Share a card',
    previewAlt: 'Preview of the card',
    sizeLabel: 'Size',
    sizes: { story: 'Story', post: 'Post' },
    backgroundLabel: 'Background',
    /** The built-in backgrounds' names, by id (drawn in shareCards/drawCard.ts). */
    backgrounds: { clay: 'Clay', night: 'Night court', sunset: 'Sunset', sand: 'Sand' },
    photoLabel: 'Use your own photo',
    photoNote: 'Your photo stays on this device.',
    photoChoice: 'Your photo',
    darknessLabel: 'Darken the photo',
    shareButton: 'Share',
    close: 'Close',
    drawing: 'Making the card…',
    /** Inside Messenger, Facebook or Instagram, whose browser blocks downloads and sharing (T8.7). */
    inAppNote: 'This app’s browser can’t save or share images. Press and hold the card to save it, or open this page in Safari or Chrome (••• → Open in browser).',
    /** Under the preview on other touch screens. */
    holdHint: 'You can also press and hold the card to save it.',
    /** The player card's stat labels (with `record` and `diff` above). */
    winRateLabel: 'Win %',
    streakLabel: 'Best streak',
    /** Under the group card's rows when not everyone fits. */
    more: (n: number) => `+${n} more`,
    /** Arranging the player card in the preview (T8.7b). */
    layout: {
      hint: 'Tap the card to pick it, then drag it to move it.',
      itemSize: 'Size of the picked item',
      opacity: 'Card background',
      lookLabel: 'Look',
      looks: { default: 'Default', compact: 'Compact', list: 'List' },
      items: { player: 'Player card' },
      /** The parts of the card that can be removed; the logo and the link always stay (T8.7c). */
      parts: { name: 'Name', record: 'W–L', winRate: 'Win %', streak: 'Best streak', diff: '+/−', title: 'Title', date: 'Date' },
      select: (label: string) => `Pick ${label}`,
      remove: (label: string) => `Remove ${label}`,
      restore: (label: string) => `Add ${label} back`,
      removedLabel: 'Removed',
      reset: 'Reset layout',
    },
    groupFileName: 'paddle-stack-standings.png',
    /** A file name safe on every phone: lowercase letters, digits and dashes. */
    playerFileName: (name: string) => {
      const slug = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return `paddle-stack-${slug || 'player'}.png`
    },
  },
  handoff: {
    bad: 'This link doesn’t work. Ask the venue for a new one.',
    expired: 'This live stack has ended or expired. Ask the venue for a new link.',
    failed: 'Couldn’t open the venue’s stack. Check your connection, then open the link again.',
    ask: 'A session is already running on this device. Replace it with the venue’s stack?',
    replace: 'Replace it',
    keep: 'Keep my session',
    venueOf: (name: string) => `Open play at ${name}`,
  },
  live: {
    goLive: 'Go live',
    goLiveIntro: 'Players open a link or scan a QR code on their own phones and see the board update live. They can’t change anything.',
    checking: 'Quick check that you’re a person, then the link appears.',
    checkFailed: 'The check didn’t load. Turn off anything that blocks it, then try again.',
    linkLabel: 'Link for players',
    qrLabel: 'QR code for the link',
    copyLink: 'Copy link',
    copied: 'Link copied.',
    copyFailed: 'Couldn’t copy. Select the link and copy it by hand.',
    sending: 'Going live…',
    status: {
      label: 'Live status',
      live: 'Live',
      reconnecting: 'Reconnecting…',
      stopped: 'Stopped',
    },
    stopped: {
      ended: 'The session has ended. The players’ link shows the final standings.',
      forbidden: 'Another device took over this live stack. This device can’t update it any more.',
      not_found: 'This live stack has ended or expired. Start it again with Go live.',
      limit_reached: 'This live stack reached its update limit. Start it again with Go live.',
      too_large: 'The board is too big to share live. Changes are kept on this device.',
      invalid_snapshot: 'The board couldn’t be shared. Changes are kept on this device.',
    },
    errors: {
      unavailable: 'Going live is off right now. The board keeps working.',
      bot_check_failed: 'The check didn’t pass. Try again.',
      invalid_input: 'Check the title and courts, then try again.',
      busy: 'Too many live stacks right now. Try again later.',
      server_error: 'Something went wrong. Try again.',
      unknown: 'Something went wrong. Try again.',
    },
  },
  /** The player view at /paddle-stack/live/<code> (T6.4): view-only, on the players' own phones. */
  viewer: {
    heading: 'Live stack',
    loading: 'Loading the board…',
    notFound: 'This stack has ended. Ask the organizer for a new link.',
    error: 'Couldn’t load the board. Check your connection, then reload.',
    reload: 'Reload',
    notStarted: 'The board appears here as soon as the organizer starts it.',
    viewOnly: 'View only: the organizer runs the board.',
    live: 'Live',
    polling: 'Reconnecting… checking for changes every 15 seconds.',
    endedNote: 'This session has ended.',
    lastUpdated: 'Last updated',
    statusLabel: 'Live status',
    bookCourt: 'Book a court',
    finalStandings: 'Final standings',
    ownStack: 'Run your own open play with Paddle Stack, free.',
    ownStackLink: 'Open Paddle Stack',
    /** "Share my card" (T6.5): a player picks their name and the T8.7 card is made on their phone. */
    myCard: {
      button: 'Share my card',
      pickLabel: 'Your name',
      pickPrompt: 'Pick your name',
      make: 'Make my card',
      cancel: 'Cancel',
    },
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
        body: 'Copy the sign-up list from your Reclub or Messenger group and paste it into Players. Numbers like “1.” and repeated names are dropped. Each name then shows with an optional level (Beginner, Intermediate or Advanced) for the formats that match by skill. Pick your courts and a rotation, then start the stack. Late arrivals go in with Add players.',
      },
      {
        title: 'Singles, doubles and pairs',
        body: 'Pick Singles for one player a side or Doubles for two. In doubles the board makes new teams from the line, and you can lock any two players as a pair, on the start screen or on the board: a pair plays together as one team, and queues, rests and leaves together. Unlock it from the line or the time-out list. Americano and Mexicano change partners, so they have no pairs. Rotations that don’t fit your choice are hidden.',
      },
      {
        title: 'Fair rotation',
        body: 'The next in line take the open court, and when their game ends they all go to the back of the line. Everyone plays about the same number of games, whoever wins.',
      },
      {
        title: 'Winners stay, split up',
        body: 'The winners keep the court but play against each other, each with a new partner from the line. After two wins in a row they go off too, so nobody holds a court all night. Doubles only.',
      },
      {
        title: 'Americano (Round Robin) and Mexicano',
        body: 'Both play in rounds and change partners. Americano (Round Robin) gives everyone a new partner every game for as long as the numbers allow. Mexicano matches each round by the standings, 1st and 4th against 2nd and 3rd, so games stay close. Each player keeps their own wins, losses and points.',
      },
      {
        title: 'Skill groups and Winners vs Losers',
        body: 'Skill groups puts players of the same level on court together; players with no level fit any group, and nobody waits forever. Winners vs Losers sends winners to play winners and losers to play losers.',
      },
      {
        title: 'Put the courts on a TV',
        body: 'Connect a laptop or tablet to a TV facing the courts and use TV mode, or open the TV board in a new window and keep scoring in this one. Turn on call-outs and the device announces each court and its names.',
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
        q: 'Which rotation should I pick?',
        a: 'Fair rotation for a relaxed night where everyone plays the same. Skill groups or Mexicano when levels vary and you want close games. Americano (Round Robin) to mix partners. Winners stay or Winners vs Losers for a competitive crowd.',
      },
      {
        q: 'Where is my session saved? Can I use more than one phone?',
        a: 'In this browser on this device: a refresh or a closed tab picks up where you left off, and nothing is sent to us. One device runs the session; a TV window on the same device follows it.',
      },
      {
        q: 'What if someone takes a break or leaves early?',
        a: 'Tap Time out and they skip their turns until you put them back in line. Remove takes them off the list and out of the standings.',
      },
    ],
  },
}
