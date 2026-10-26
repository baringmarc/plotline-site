// Everything a visitor reads on the landing page lives here: brand, links, copy, prices, FAQ.
// Change the words here, not in the components. All of it is placeholder copy for now.

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
  demoUrl: 'https://demo.example.com',
}

export const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

export const hero = {
  eyebrow: 'For pickleball and court sports venues',
  title: 'Still taking bookings in your inbox?',
  /** Words in the title shown in the highlight colour. Empty for none. */
  titleHighlight: 'your inbox',
  lead:
    'Give your venue its own booking page. Players see what is open, book a slot and join open play in a minute, with no app and no account. You see every booking from your phone.',
  primaryCta: `Start your ${site.trialDays}-day free trial`,
  secondaryCta: 'See a live demo',
  points: ['No credit card to start', 'Set up in a day', 'Cancel any time'],
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

export const audiences = [
  {
    title: 'For players',
    points: [
      'See open slots for every court, live',
      'Book and pay in a minute, no app to install',
      'Join open play and see who else is coming',
      'Get a reminder before the game',
    ],
  },
  {
    title: 'For venue owners',
    points: [
      'Every booking in one list, on your phone',
      'No more double bookings or lost messages',
      'Set your own rates for peak and off-peak hours',
      'Know how full your courts are each week',
    ],
  },
]

export const openPlay = {
  title: 'Open play, without the group chat',
  lead:
    'Post a session, set the skill level and the number of slots, and share one link. Players sign up themselves, and you see the list fill before anyone arrives.',
  points: ['Slots and waitlist', 'Skill levels', 'Pay ahead or at the venue', 'One link to share'],
}

export const features = [
  { icon: '📅', title: 'Live slot grid', body: 'Each court and each hour, open or taken, updated the moment someone books.' },
  { icon: '📱', title: 'Built for phones', body: 'Your players book from Messenger links and your staff manage from the counter.' },
  { icon: '💸', title: 'GCash and Maya', body: 'Take payment ahead, or let players pay when they arrive. Your choice per court.' },
  { icon: '🏓', title: 'Open play sessions', body: 'Slots, waitlist and skill level for each session, filled by players themselves.' },
  { icon: '🔔', title: 'Booking alerts', body: 'Get notified of each new booking, so nothing waits for a reply.' },
  { icon: '🌐', title: 'Your own web address', body: 'A booking page with your name and logo that you can share anywhere.' },
]

export type Plan = {
  name: string
  price: string
  period: string
  blurb: string
  points: string[]
  highlight?: boolean
}

export const plans: Plan[] = [
  {
    name: 'Starter',
    price: '₱799',
    period: '/month',
    blurb: 'For venues with 1 to 2 courts.',
    points: ['Booking page and slot grid', 'Unlimited bookings', 'Email alerts'],
  },
  {
    name: 'Venue',
    price: '₱1,499',
    period: '/month',
    blurb: 'For venues with 3 to 6 courts.',
    points: ['Everything in Starter', 'Peak and off-peak rates', 'Staff accounts'],
    highlight: true,
  },
  {
    name: 'Club',
    price: 'Let’s talk',
    period: '',
    blurb: 'For 7 courts or more, or several locations.',
    points: ['Everything in Venue', 'Several locations', 'Priority support'],
  },
]

/** The open play add-on is priced by venue size; the sign-up form shows the matching price. */
export const openPlayAddon = {
  smallMaxCourts: 2,
  smallPrice: '₱299/month',
  bigPrice: '₱499/month',
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
