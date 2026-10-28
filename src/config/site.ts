// Everything a visitor reads on the landing page lives here: brand, links, copy, prices, FAQ.
// Change the words here, not in the components. Values still to be provided or decided are marked PLACEHOLDER;
// T1.11 replaces them (`grep -rn PLACEHOLDER src index.html`).

import { peso, pricing } from './pricing'

/** The pricing model lives in ./pricing; re-exported so components import copy from one place. */
export { peso, pricing }
/** The Terms and Privacy text live in ./legal (too long for this file). */
export { legalDraftNotice, privacy, terms, type LegalPage } from './legal'

export const site = {
  name: 'Plotline',
  /** Shown after the name in the logo, in the accent colour. Empty to hide. */
  nameSuffix: '',
  tagline: 'Online court booking for your venue',
  /** The brand line from the style guide, shown in the footer. */
  slogan: 'Plot your day. Fill your hours.',
  trialDays: 7,
  /** PLACEHOLDER: on our domain, but the mailbox isn't set up yet. */
  supportEmail: 'hello@plotline.fit',
  /** PLACEHOLDER: Plotline's Messenger link (m.me/…). Empty: "Message us" links fall back to email. */
  messengerUrl: '',
  /** PLACEHOLDER: Plotline's Facebook page. Empty: the footer hides the link. */
  facebookUrl: '',
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
    `A ${fee} booking fee per online booking, paid by the player`,
  ],
  stats: [
    { label: 'To start', value: peso(0), note: 'and nothing every month' },
    { label: 'The only fee', value: fee, note: 'per online booking, paid by the player' },
  ],
  primaryCta: 'Get your venue online',
  secondaryCta: 'See a live demo',
}

export const shortVersion = {
  label: 'The short version',
  title: 'What you get, and what it costs',
  lead: `Plotline costs your venue nothing. Players pay a ${fee} booking fee when they book online, and that is all we earn.`,
  get: {
    title: 'What you get, free',
    points: [
      'Your own booking page with your venue’s name',
      'A live slot grid for every court',
      'Every booking and payment proof on your phone',
      'Peak and off-peak rates, set by you',
      'Open play sessions shown on your grid',
      'We set up your courts, hours and rates with you',
      'A walkthrough for you and your staff',
    ],
  },
  cost: {
    title: 'What it costs',
    points: [
      `${fee} per confirmed online booking, whatever its length or court`,
      'Paid by the player and shown before they pay',
      'You collect it with the court price',
      'We bill the fees on one invoice a month',
    ],
    notCharged: ['No subscription', 'No setup fee', 'No monthly fee', `No fee on ${pricing.notBilled[0].toLowerCase()}`],
  },
  money: 'Players pay you, not us. Plotline never holds your money.',
}

export type Venue = { name: string; location: string; url?: string; logoUrl?: string }

/**
 * PLACEHOLDER: only the demo venue for now. Add real venues (with their permission) and switch `venuesHead`
 * to the "already booking online" wording; never list a venue that doesn't use Plotline.
 */
export const venues: Venue[] = [{ name: 'Claudex Courts', location: 'Our demo venue', url: site.demoUrl }]

export const venuesHead = {
  label: 'Venues',
  title: 'See a venue on Plotline',
  lead: 'Claudex Courts is our demo venue. Open it to see a booking page the way players see it.',
}

export type ScreenImage = { src: string; width: number; height: number; alt: string }
/** The drawn screens for steps the demo can't show without a real booking. */
export type ScreenMock = 'pay' | 'confirmed' | 'link'

/** The player's booking flow, step by step. Steps 1–2 are screenshots of the live demo; 3–5 are drawn for now. */
export const playerSide = {
  label: 'The player’s side',
  title: 'Booked in a minute, with no app to install',
  lead: 'This is what your players see, from your link to their booking.',
  stepLabel: (n: number, total: number) => `Step ${n} of ${total}`,
  steps: [
    {
      title: 'Find a free slot',
      body: 'They open your link and see every court and hour, open or booked, with your peak and off-peak prices.',
      image: {
        src: '/screens/step-1-find.webp',
        width: 390,
        height: 844,
        alt: 'The booking grid on a phone: three pickleball courts from 1 PM to midnight, cheaper in the afternoon and dearer in the evening.',
      },
    },
    {
      title: 'Pick a time',
      body: 'A tap picks an hour and more taps make it longer. The total shows as they go.',
      image: {
        src: '/screens/step-2-pick.webp',
        width: 390,
        height: 844,
        alt: 'Two hours picked on Pickleball 2, 5 PM to 7 PM, with the total and a Continue button.',
      },
    },
    {
      title: 'Pay you directly',
      body: `The court price plus the ${fee} booking fee, into your GCash, Maya or bank with a proof, or through your PayMongo.`,
      mock: 'pay',
    },
    {
      title: 'You confirm it',
      body: 'A payment proof waits for your OK. PayMongo payments confirm on their own.',
      mock: 'confirmed',
    },
    {
      title: 'Their booking, one link',
      body: 'They get a private link to their booking. If they sign in, it’s in My bookings too.',
      mock: 'link',
    },
  ] as { title: string; body: string; image?: ScreenImage; mock?: ScreenMock }[],
  /** The sample booking the drawn screens show; it continues the one picked in step 2. */
  sample: {
    court: 'Pickleball 2',
    when: 'Wed, Oct 28 · 5 PM–7 PM',
    hours: 2,
    courtPrice: 1000,
    reference: 'CB-7K2QDM',
    link: 'claudex-courts.plotline.fit/booking/…',
  },
  mocks: {
    payTitle: 'Pay the venue',
    court: (hours: number) => `Court, ${hours} hours`,
    fee: 'Booking fee',
    total: 'Total',
    methods: ['GCash', 'Maya', 'Bank', 'PayMongo'],
    payButton: 'Upload payment proof',
    confirmed: 'Confirmed',
    reference: 'Reference',
    linkTitle: 'Save this link',
    linkBody: 'It opens this booking without an account.',
    copy: 'Copy link',
  },
}

/** A callout under the player's steps. Open play is a marked session on the grid; players don't sign up in the app. */
export const openPlay = {
  title: 'Open play, on the same grid',
  lead:
    'Post a session on any courts and hours. Players see it on your booking page with your details and your RSVP or Reclub link, and nobody can book over it.',
  points: ['On any courts', 'Your title and details', 'Up to 3 links', 'Never billed'],
}

/** The owner's side. Only features court-booking-system ships today (SPEC §3.1 "Feature claims"). */
export const featuresHead = {
  label: 'Your side',
  title: 'Run your courts from your phone',
  lead: 'Everything you need at the counter, on a phone or a laptop, with nothing new to learn.',
}

export const features = [
  {
    icon: '📅',
    title: 'Today’s courts at a glance',
    body: 'Every court and hour for today, with who is playing and their booking reference.',
  },
  {
    icon: '🧾',
    title: 'Payment proofs in a tap',
    body: 'See the proof, get a warning when the amount doesn’t match, then approve it or reject it with a reason so the player can send a new one.',
  },
  {
    icon: '🌗',
    title: 'Peak and off-peak rates',
    body: 'Charge more on evenings and weekends and less when it’s quiet. Players see each price on the grid.',
  },
  {
    icon: '🚧',
    title: 'Hours and blackouts',
    body: 'Set your opening hours and block off times for repairs or private events, so nobody books them.',
  },
  {
    icon: '🔁',
    title: 'Move a booking',
    body: 'Rain, repairs or a request? Move a confirmed booking to another court or time for the same sport. The player sees the change and your reason.',
  },
  {
    icon: '📈',
    title: 'Earnings and occupancy',
    body: 'Money collected by method, booked hours and how full each court is, for a day, week, month or your own range. Export it to CSV.',
  },
]

export const costs = {
  label: 'What it costs',
  title: `${fee} per online booking. Nothing else.`,
  lead: 'The player pays the booking fee on top of your court price, so your rate stays yours.',
  stats: [
    { label: 'Setup and monthly', value: peso(0), note: 'no subscription and no setup fee' },
    { label: 'Per online booking', value: fee, note: 'paid by the player, whatever its length' },
  ],
  example: {
    title: 'One booking, worked out',
    ratePerHour: 400,
    hours: 2,
    caption: (hours: number, rate: string) => `${hours} hours at ${rate} an hour`,
    courtPrice: 'Court price',
    fee: 'Booking fee, paid by the player',
    playerPays: 'The player pays you',
    venueKeeps: 'You keep',
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
  title: 'Players pay you. We send one invoice a month.',
  steps: [
    { title: 'The player books', body: `They see the court price and the ${fee} booking fee before they pay.` },
    {
      title: 'They pay you',
      body: 'Straight into your own GCash, Maya or bank account, or through your own PayMongo account.',
    },
    { title: 'The booking is confirmed', body: 'When you approve their payment proof, or as soon as PayMongo confirms it.' },
    { title: 'One invoice a month', body: 'Early each month we bill the fees from the month before, with every booking listed.' },
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

export const faqs = [
  {
    q: 'Do my players need to download an app?',
    a: 'No. Your booking page opens in any phone browser, straight from a Messenger or Facebook link. Players can book as a guest or sign in.',
  },
  {
    q: 'What if a player books and doesn’t pay?',
    a: 'The slot is held for a set time while they pay. If no payment or proof arrives, it goes back on sale by itself. Nothing is billed for a booking that was never confirmed.',
  },
  {
    q: 'What if a player cancels?',
    a: `They can cancel up to your cut-off time, and you settle any refund with them directly. Once a booking was confirmed, its ${fee} fee still counts. If you cancel a booking, the player gets the fee back and it isn’t billed to you.`,
  },
  {
    q: 'What does PayMongo cost?',
    a: 'PayMongo charges its own fee on online payments, on the whole amount the player pays. That fee is between you and PayMongo, in your own account. GCash, Maya and bank payments sent to you with a proof don’t go through PayMongo.',
  },
  {
    q: 'Can I change my rates and hours later?',
    a: 'Any time, from your admin pages. Your booking page shows the change right away.',
  },
  {
    q: 'Does open play cost anything?',
    a: 'No. Post a session with your details and links, and it shows on your grid so nobody books over it. Open play is never billed.',
  },
  {
    q: 'Can my staff log in too?',
    a: 'Yes. When we set up your venue, we also set up the logins you and your team need.',
  },
  {
    q: 'How do I pay Plotline?',
    a: 'Once a month we send one invoice for the booking fees your venue collected, with every booking listed. You pay it by GCash or bank transfer.',
  },
]

/** The offer as a fact sheet. Exit terms and the provider are left out until they are settled (SPEC §7). */
export const atAGlance = {
  label: 'At a glance',
  title: 'The whole offer, on one card',
  rows: [
    { label: 'Service', value: 'An online booking page for your courts, and admin pages to run them' },
    { label: 'Setup fee', value: peso(0) },
    { label: 'Monthly fee', value: peso(0) },
    { label: 'Booking fee', value: `${fee} per confirmed online booking, paid by the player` },
    { label: 'Not billed', value: pricing.notBilled.map((n, i) => (i ? n[0].toLowerCase() + n.slice(1) : n)).join(', ') },
    { label: 'Payments', value: 'Players pay you directly: GCash, Maya, bank, or your own PayMongo account' },
    { label: 'Billing', value: 'One invoice a month, with every booking listed' },
    { label: 'Your data', value: 'Export your bookings and payments to CSV from your admin pages' },
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

export const courtOptions = Array.from({ length: 12 }, (_, i) => i + 1)
