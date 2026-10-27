// Everything a visitor reads on the landing page lives here: brand, links, copy, prices, FAQ.
// Change the words here, not in the components. All of it is placeholder copy for now.

import { peso, pricing } from './pricing'

/** The pricing model lives in ./pricing; re-exported so components import copy from one place. */
export { peso, pricing }

export const site = {
  name: 'Plotline',
  /** Shown after the name in the logo, in the accent colour. Empty to hide. */
  nameSuffix: '',
  tagline: 'Online court booking for your venue',
  /** The brand line from the style guide, shown in the footer. */
  slogan: 'Plot your day. Fill your hours.',
  trialDays: 7,
  supportEmail: 'hello@example.com',
  messengerUrl: 'https://m.me/your-page',
  facebookUrl: 'https://www.facebook.com/your-page',
  /** A live booking site visitors can try. */
  demoUrl: 'https://claudex-courts.plotline.fit',
}

const fee = peso(pricing.bookingFee)

export const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

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

/** Venues already using the platform. Replace with real ones (with their permission). */
export const venues: Venue[] = [
  { name: 'Sample Pickle Park', location: 'Quezon City' },
  { name: 'Baseline Courts', location: 'Pasig' },
  { name: 'Kitchen Line Club', location: 'Cebu City' },
  { name: 'Rally Yard', location: 'Davao City' },
  { name: 'Third Shot Hub', location: 'Lucena City' },
  { name: 'Net Play Arena', location: 'Iloilo City' },
  { name: 'Sunrise Dink Court', location: 'Batangas City' },
  { name: 'Corner Court PH', location: 'Baguio' },
]

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

export const featuresHead = {
  label: 'What you get',
  title: 'Everything a court venue needs',
  lead: 'Nothing you have to learn. Your staff can use it on day one.',
}

export const features = [
  { icon: '📅', title: 'Live slot grid', body: 'Each court and each hour, open or taken, updated the moment someone books.' },
  { icon: '📱', title: 'Built for phones', body: 'Your players book from Messenger links and your staff manage from the counter.' },
  { icon: '💸', title: 'GCash and Maya', body: 'Take payment ahead, or let players pay when they arrive. Your choice per court.' },
  { icon: '🏓', title: 'Open play sessions', body: 'Slots, waitlist and skill level for each session, filled by players themselves.' },
  { icon: '🔔', title: 'Booking alerts', body: 'Get notified of each new booking, so nothing waits for a reply.' },
  { icon: '🌐', title: 'Your own web address', body: 'A booking page with your name and logo that you can share anywhere.' },
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

export const steps = [
  { title: 'Sign up', body: 'Tell us about your venue. It takes two minutes.' },
  { title: 'We set it up', body: 'We add your courts, hours and rates, and send you your link.' },
  { title: 'Share your link', body: 'Post it on your page and in your group chats. Bookings start coming in.' },
]

export const faqs = [
  {
    q: 'Do my players need to download an app?',
    a: 'No. Your booking page opens in any phone browser, including straight from Messenger.',
  },
  {
    q: 'What happens after the free trial?',
    a: `After ${site.trialDays} days you choose a plan. If you do not, your page simply stops taking new bookings. We never charge you without asking.`,
  },
  {
    q: 'Can I still take walk-ins?',
    a: 'Yes. Add walk-ins from your phone so the slot grid stays right for everyone else.',
  },
  {
    q: 'How do players pay?',
    a: 'You choose: pay ahead with GCash or Maya, or pay at the venue. You can mix both.',
  },
  {
    q: 'Can I change my rates and hours later?',
    a: 'Any time, from your dashboard. Changes show on your booking page right away.',
  },
]

export const courtOptions = Array.from({ length: 12 }, (_, i) => i + 1)
