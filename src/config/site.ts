// Everything a visitor reads on the landing page lives here: brand, links, copy, prices, FAQ.
// Change the words here, not in the components. Values still to be provided or decided are marked PLACEHOLDER;
// T1.11b replaces them (`grep -rn PLACEHOLDER src index.html`).

import { provider } from './legal'
import { peso, pricing } from './pricing'

/** The pricing model lives in ./pricing; re-exported so components import copy from one place. */
export { peso, pricing }
/** The Terms and Privacy text live in ./legal (too long for this file). */
export { legalDraftNotice, privacy, provider, terms, type LegalPage } from './legal'

export const site = {
  name: 'Plotline',
  /** Shown after the name in the logo, in the accent colour. Empty to hide. */
  nameSuffix: '',
  tagline: 'Online court booking for your venue',
  /** The brand line from the style guide, shown in the footer. */
  slogan: 'Plot your day. Fill your hours.',
  supportEmail: 'plotline.admin1@gmail.com',
  /** Plotline's Messenger link. Empty: "Message us" links fall back to email. */
  messengerUrl: 'https://m.me/61595759948011',
  /** Plotline's Facebook page. Empty: the footer hides the link. */
  facebookUrl: 'https://www.facebook.com/profile.php?id=61595759948011',
  /** A live booking site visitors can try. */
  demoUrl: 'https://claudex-courts.plotline.fit',
  /** PLACEHOLDER: a scheduling page (Google Calendar or Cal.com) shown after the contact form. Empty hides the link (SPEC §7). */
  bookCallUrl: '',
}

/** Where "Message us" goes: Messenger once it's set, email until then. */
export const messageLink = site.messengerUrl || `mailto:${site.supportEmail}`

const fee = peso(pricing.bookingFee)

/** Section anchors in the top bar. Each must match a section id on the landing page. */
export const navLinks = [
  { href: '#players', label: 'For players' },
  { href: '#features', label: 'Your side' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

/** The contact form's anchor, the target of every call to action. */
export const contactAnchor = '#contact'

export const nav = {
  cta: 'Get started',
  messenger: 'Message us',
}

export const hero = {
  eyebrow: 'For pickleball and court sports venues',
  title: 'Online booking for your courts, free for your venue',
  /** Words in the title shown in the highlight colour. Empty for none. */
  titleHighlight: 'free for your venue',
  lead:
    'Your venue gets its own booking page. Players see what is open, book a slot and pay you directly, with no app to install. You see every booking from your phone.',
  promisesLabel: 'The deal',
  promises: [
    'Free for venues: no subscription and no setup fee',
    'Players pay you directly, into your own GCash, Maya or bank',
    `Players add a ${fee} booking fee to each online booking`,
  ],
  primaryCta: 'Get your venue online',
  secondaryCta: 'See a live demo',
}

/** A slim card that points to Pricing; the cost story is told there once. */
export const shortVersion = {
  label: 'The short version',
  title: `Free for your venue. Players pay ${fee}.`,
  titleHighlight: 'Free',
  lead: 'That fee is all we earn. Players pay you, not us, and Plotline never holds your money.',
  link: 'See the full pricing',
  get: {
    title: 'What you get, free',
    titleHighlight: 'free',
    points: [
      'Your own booking page',
      'Unlimited courts',
      'Live slot grid per court',
      'Bookings and proofs on your phone',
      'Peak and off-peak rates',
      'Open play on your grid',
      'Setup done with you',
      'Walkthrough for your staff',
    ],
  },
}

export type Venue = { name: string; location: string; url: string }

/** The demo venue. Real venues come from the live feed (`public_venues`); the demo is never one of them. */
export const demoVenue: Venue = { name: 'Claudex Courts', location: 'Our demo venue', url: site.demoUrl }

export const venuesHead = {
  label: 'Venues',
  title: 'See a venue on Plotline',
  lead: 'Claudex Courts is our demo venue. Open it to see a booking page the way players see it.',
  open: 'Open the demo',
}

/** The Venues section once at least one approved venue is in the feed. */
export const venuesLive = {
  label: 'Venues',
  title: 'Venues already booking online',
  lead: 'Courts that take bookings on Plotline. Open one to book the way your players would.',
  open: 'Book a court',
  demo: 'Or try our demo venue, Claudex Courts',
}

/** The drawn phone screens, in the app's dark theme. */
export type ScreenMock = 'pick' | 'pay' | 'confirmed' | 'link'

/** The player's booking flow, step by step. All four screens are drawn. */
export const playerSide = {
  label: 'The player’s side',
  title: 'Booked in a minute, with no app to install',
  lead: 'From your link to their booking.',
  stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
  steps: [
    {
      title: 'Pick a free slot',
      body: 'Every court and hour, with your peak and off-peak prices. Tap an hour, tap more to make it longer.',
      mock: 'pick',
      alt: 'The booking grid on a phone: three pickleball courts by the hour, open and booked slots, Pickleball 2 picked for 5 PM to 7 PM, the total and a Continue button.',
    },
    {
      title: 'Pay you directly',
      body: `Court price plus the ${fee} fee, into your GCash, Maya or bank, or through PayMongo.`,
      mock: 'pay',
      alt: 'The payment screen: court price plus the booking fee, a choice of GCash, Maya, bank or PayMongo, the venue’s GCash QR code, and an upload button.',
    },
    {
      title: 'You confirm it',
      body: 'A payment proof waits for your OK. PayMongo payments confirm on their own.',
      mock: 'confirmed',
      alt: 'The confirmed booking with its reference and total.',
    },
    {
      title: 'Their booking, one link',
      body: 'A private link to their booking. If they sign in, it’s in My bookings too.',
      mock: 'link',
      alt: 'A private link to the booking, with a Copy link button.',
    },
  ] as { title: string; body: string; mock: ScreenMock; alt: string }[],
  /** The sample booking the drawn screens show; it continues the one picked in step 1. */
  sample: {
    court: 'Pickleball 2',
    when: 'Wed, Oct 28 · 5 PM–7 PM',
    day: 'Wed, Oct 28',
    hoursLabel: '5 to 7 PM',
    hours: 2,
    courtPrice: 1000,
    reference: 'CB-7K2QDM',
    link: 'claudex-courts.plotline.fit/booking/…',
  },
  mocks: {
    findTitle: 'Claudex Courts',
    findSub: 'Booking by Plotline',
    days: ['Thu', 'Fri', 'Sat'],
    findCourts: ['Pickleball 1', 'Pickleball 2', 'Pickleball 3'],
    findHours: ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM'],
    open: 'Open',
    booked: 'Booked',
    picked: 'Yours',
    hoursPicked: '2 hours',
    continue: 'Continue',
    payTitle: 'Pay the venue',
    paySub: 'Pickleball 2 · 5 to 7 PM',
    qrTitle: 'Pay with GCash',
    qrNote: 'Scan to pay the venue',
    court: (hours: number) => `Court, ${hours} hours`,
    fee: 'Booking fee',
    total: 'Total',
    methods: ['GCash', 'Maya', 'Bank', 'PayMongo'],
    payButton: 'Upload payment proof',
    confirmed: 'Confirmed',
    reference: 'Reference',
    confirmedTitle: 'Booking',
    linkTitle: 'Save this link',
    linkBody: 'It opens this booking without an account.',
    copy: 'Copy link',
  },
}

/** A one-line strip under the player's steps. Open play is a marked session on the grid; players don't sign up in the app. */
export const openPlay = {
  title: 'Open play, on the same grid',
  text: 'Post a session on any courts and hours. Nobody can book over it, and it is never billed.',
  chips: ['Your title and details', 'Up to 3 links'],
}

/** The owner's side. Only features court-booking-system ships today (SPEC §3.1 "Feature claims"). */
export const featuresHead = {
  label: 'Your side',
  title: 'Run your courts from your phone',
  lead: 'Everything you need at the counter, with nothing new to learn.',
}

export const features = [
  {
    icon: 'calendar',
    title: 'Today at a glance',
    body: 'Every court and hour, who is playing, and their reference.',
  },
  {
    icon: 'receipt',
    title: 'Payment proofs in a tap',
    body: 'Approve it, or reject it with a reason. You get a warning if the amount is off.',
  },
  {
    icon: 'move',
    title: 'Move a booking',
    body: 'Rain or repairs? Move it to another court or time in the same sport. The player sees your reason.',
  },
]

export const featuresAlsoLabel = 'Also in your admin'
export const featuresAlso = ['Peak and off-peak rates', 'Hours and blackouts', 'Earnings and occupancy, with CSV export']

/** Platform features that make a venue's page its own. No colour presets yet: they are being redone (SPEC §3.1). */
export const highlightsHead = {
  label: 'Your venue, your way',
  title: 'A booking page that looks like yours',
  lead: 'Your name and your payment details, on a page players open without an app or an account.',
}

export const highlights = [
  {
    icon: '🎨',
    title: 'Your look',
    body: 'Banner, court photos, amenities, house rules, social links and a Google Maps pin.',
  },
  {
    icon: '🌐',
    title: 'Your own address',
    body: 'yourvenue.plotline.fit, ready for your Facebook page and group chats.',
  },
  {
    icon: '📲',
    title: 'Your payment accounts',
    body: 'Up to 10 GCash, Maya or bank accounts, each with its own QR code.',
  },
  {
    icon: '🏸',
    title: 'Every sport on one page',
    body: 'Badminton, pickleball, basketball and tennis, grouped by sport in your order.',
  },
]

export const highlightsAlsoLabel = 'Players also get'
export const highlightsAlso = ['Guest booking, no account', 'Booking emails in your venue’s name', 'My bookings when they sign in']

export const costs = {
  label: 'What it costs',
  title: `${fee} per online booking. Nothing else.`,
  lead: 'The player pays the fee on top of your court price, so your rate stays yours.',
  stats: [
    { label: 'Setup and monthly', value: peso(0), note: 'No subscription and no setup fee' },
    { label: 'Per confirmed online booking', value: fee, note: 'Paid by the player, whatever the length' },
  ],
  example: {
    title: 'One booking, worked out',
    ratePerHour: 400,
    hours: 2,
    caption: (hours: number, rate: string) => `${hours} hours at ${rate} an hour.`,
    courtPrice: 'Court price',
    fee: 'Booking fee, paid by the player',
    playerPays: 'The player pays you',
    venueKeeps: 'You keep',
    courtLabel: 'Court',
    feeLabel: 'Fee',
    playerPaysLine: 'The player pays',
    ourFee: 'Our fee',
    notToScale: 'The fee is drawn wider than its true share so it can be read.',
  },
  compare: {
    title: 'A flat fee vs a percentage',
    /** An illustrative percentage fee, not any company's price. */
    percent: 5,
    courtPrices: [300, 600, 1200, 2400],
    columns: { courtPrice: 'Court price', flat: 'Plotline', percentage: (percent: number) => `A ${percent}% fee` },
    note: (percent: number) => `The ${percent}% column only illustrates a percentage fee. It isn’t anyone’s actual price.`,
  },
  cta: 'Get your venue online',
}

export const moneyFlow = {
  label: 'Where the money goes',
  lead: 'Players pay you, not us. Plotline never holds your money.',
  steps: [
    { title: 'Player books', body: `Sees the court price and the ${fee} fee first.` },
    { title: 'They pay you', body: 'Into your GCash, Maya, bank or PayMongo.' },
    { title: 'Booking confirmed', body: 'When you approve the proof, or PayMongo confirms.' },
    { title: 'One invoice a month', body: 'The fees from last month, every booking listed.' },
  ],
  neverBilled: 'Never billed',
  quiet: 'A quiet month costs you nothing.',
}

export const stepsHead = {
  label: 'Getting started',
  title: 'Live in four steps',
  lead: 'Nothing to set up on your own. We get your venue online together with you.',
}

export const steps = [
  { title: 'You contact us', body: 'Send the form below or message us, and we set up a call at a time that suits you.' },
  { title: 'We set up your venue', body: 'We add your courts, opening hours, rates and payment details with you.' },
  {
    title: 'You get your link',
    body: 'Your own booking page, ready to post on your Facebook page and in your group chats.',
  },
  { title: 'We walk you through it', body: 'A short walkthrough for you and your team, and we stay a message away after.' },
]

export const faqHead = {
  label: 'Questions',
  title: 'What owners ask us',
  /** Shown before the "Message us" link. */
  lead: 'Something else?',
  leadLink: 'Message us',
}

export type FaqGroup = { id: 'players' | 'money' | 'setup'; label: string; items: { q: string; a: string }[] }

export const faqGroups: FaqGroup[] = [
  {
    id: 'players',
    label: 'Players',
    items: [
      {
        q: 'Do my players need an app?',
        a: 'No. Your page opens in any phone browser, straight from a Messenger or Facebook link. Players can book as a guest or sign in.',
      },
      {
        q: 'Can players see their booking later?',
        a: 'Yes. Each booking has a private link that opens without an account, and signed-in players find it under My bookings.',
      },
      {
        q: 'What if a player books and doesn’t pay?',
        a: 'The slot is held for a set time. If no payment or proof arrives, it goes back on sale by itself, and nothing is billed.',
      },
      {
        q: 'What if a player cancels?',
        a: 'They can cancel up to your cut-off time, and you settle any refund. A confirmed booking’s fee still counts.',
      },
      {
        q: 'Can I cancel or move a booking?',
        a: 'Yes. Move it to another court or time in the same sport; the player sees your reason. If you cancel it, the player gets the fee back and you aren’t billed.',
      },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      {
        q: 'How do I pay Plotline?',
        a: 'One invoice a month for the fees your venue collected, with every booking listed. Pay by GCash or bank transfer.',
      },
      {
        q: 'Do I need a payment processor?',
        a: 'No. Players pay you directly into your GCash, Maya or bank and send a proof, and you approve it. PayMongo is optional, on your own account, if you want online payments to confirm on their own.',
      },
      {
        q: 'What does PayMongo cost?',
        a: 'PayMongo charges its own fee on the whole online payment, between you and your PayMongo account. GCash, Maya and bank payments sent to you with a proof don’t go through it.',
      },
      {
        q: 'Does open play cost anything?',
        a: 'No. It shows on your grid so nobody books over it, and it is never billed.',
      },
    ],
  },
  {
    id: 'setup',
    label: 'Your setup',
    items: [
      { q: 'Is there a limit on courts?', a: 'No. Add every court you have, in any mix of sports. Nothing extra per court.' },
      { q: 'Can I manage more than one facility?', a: 'Yes. Each branch is its own venue with its own booking page, and each is billed separately.' },
      { q: 'Can I change rates and hours later?', a: 'Any time from your admin pages. Your booking page updates right away.' },
      { q: 'Can my staff log in too?', a: 'Yes. We set up the logins for you and your team when we set up your venue.' },
      {
        q: 'Can I block off a court for maintenance?',
        a: 'Yes. Block any court, or all of them, for the hours you choose. Players can’t book those times, and blocked times are never billed.',
      },
    ],
  },
]

/** How long a leaving venue's admin pages and CSV export stay open (the Terms say the same). */
const exportDays = 30

/** The offer as a fact sheet. It must agree with the Terms (./legal). */
export const atAGlance = {
  label: 'At a glance',
  title: 'The whole offer, on one card',
  lead: 'Everything in writing, in plain words. It matches our Terms.',
  keyFigures: [
    { value: peso(0), label: 'setup' },
    { value: peso(0), label: 'monthly' },
    { value: fee, label: 'per online booking' },
    { value: `${exportDays} days`, label: 'to export after leaving' },
  ],
  groups: [
    {
      title: 'The service',
      rows: [
        { label: 'Service', value: 'An online booking page for your courts, and admin pages to run them' },
        { label: 'Courts', value: 'No limit, and nothing extra per court' },
        { label: 'Provider', value: provider },
      ],
    },
    {
      title: 'The money',
      rows: [
        { label: 'Booking fee', value: `${fee} per confirmed online booking, paid by the player` },
        { label: 'Not billed', value: pricing.notBilled.map((n, i) => (i ? n[0].toLowerCase() + n.slice(1) : n)).join(', ') },
        { label: 'Payments', value: 'Players pay you directly: GCash, Maya, bank, or your own PayMongo account' },
        { label: 'Billing', value: 'One invoice a month, with every booking listed' },
      ],
    },
    {
      title: 'Your data and leaving',
      rows: [
        { label: 'Your data', value: 'Export your bookings and payments to CSV from your admin pages' },
        { label: 'Leaving', value: `Leave any time, with no notice period; your admin pages and CSV export stay open for ${exportDays} days` },
      ],
    },
  ],
}

export const finalBand = {
  title: 'Ready to stop answering “available pa po?”',
  body: 'Free for your venue. Tell us about your courts and we’ll set you up.',
}

/** The owner contact form (court-booking-system docs/PLATFORM.md §4 `site-contact`). */
export const contact = {
  label: 'Contact',
  title: 'Tell us about your courts',
  lead: 'We get back to you to set up a call. There is no account to create and nothing to pay.',
  fields: {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    phone: 'Mobile number',
    phonePlaceholder: '0917 123 4567',
    venueName: 'Venue name',
    venueNamePlaceholder: 'e.g. Claudex Courts',
    location: 'City or town',
    locationPlaceholder: 'e.g. Pasig',
    courts: 'Number of courts',
    facebook: 'Facebook page',
    facebookPlaceholder: 'facebook.com/yourvenue',
    message: 'Anything we should know?',
    messagePlaceholder: 'The best time to call, and whether you’d like an in-person or an online walkthrough',
    optional: '(optional)',
  },
  consentBefore: 'You may contact me about Plotline. I’ve read the',
  consentLink: 'privacy notice',
  turnstileNeeded: 'Please complete the check above the button.',
  turnstileFailed: 'The security check didn’t load. Reload the page, or message us instead.',
  messageUs: 'Message us',
  submit: 'Send',
  sending: 'Sending...',
  thanksTitle: 'Thanks, we’ll be in touch',
  thanksBody: 'We got your message and will contact you soon to set up a call.',
  bookCall: 'Or book a call now',
}
