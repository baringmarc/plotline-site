// The Terms and the Privacy notice. They follow court-booking-system's SAAS-PLAN §1 and §5 and the "At a glance"
// sheet; what isn't decided yet is marked PLACEHOLDER (SPEC §7, TASKS T1.11). Have both checked before launch.
import { peso, pricing } from './pricing'

export type LegalSection = { title: string; paragraphs?: string[]; list?: string[] }
export type LegalPage = { title: string; updated: string; intro: string; sections: LegalSection[] }

/** PLACEHOLDER: shown on both pages until the final text is approved. */
export const legalDraftNotice = 'Draft. This page is not final yet and will be reviewed before Plotline launches.'

/** PLACEHOLDER: the registered business that runs Plotline (a DTI-registered sole proprietor is planned). */
const provider = '[Provider name and address, to be added once the business is registered]'

const fee = peso(pricing.bookingFee)
const notBilled = pricing.notBilled.map((n, i) => (i ? n[0].toLowerCase() + n.slice(1) : n)).join(', ')

export const terms = (supportEmail: string): LegalPage => ({
  title: 'Terms for venues',
  updated: 'October 2026',
  intro: `These terms cover a venue's use of Plotline: an online booking page for your courts and the admin pages to run them. Plotline is run by ${provider}. Questions: ${supportEmail}.`,
  sections: [
    {
      title: 'The service',
      paragraphs: [
        'We set up your venue with you: your courts, opening hours, rates and payment details. Your players book on your own booking page, and you manage bookings, payment proofs, blackouts and open play from your admin pages.',
      ],
    },
    {
      title: 'What it costs',
      list: [
        `No setup fee, no subscription and no monthly fee: ${peso(0)}.`,
        `A booking fee of ${fee} per confirmed online booking, whatever its length or court. The player pays it: it is shown at checkout, on top of your court price.`,
        'A booking counts as confirmed when PayMongo confirms the payment, or when you approve the player’s payment proof.',
        `Never billed: ${notBilled}.`,
        `Once a booking is confirmed, its ${fee} fee stays billed even if the player later cancels. If you cancel a booking, the player gets the fee back and it isn’t billed to you.`,
      ],
    },
    {
      title: 'Payments',
      paragraphs: [
        'Players pay you directly: into your own GCash, Maya or bank account with a proof, or through your own PayMongo account. Plotline never holds your money. You collect the booking fee together with the court price.',
        'PayMongo’s own fee is between you and PayMongo. It is a percentage of the whole amount the player pays, booking fee included, and it comes out of what you receive.',
        'Refunds to players are between you and the player, with one exception: if a player pays through PayMongo after their booking’s hold has run out and the slot is gone, Plotline refunds that payment from your PayMongo account.',
      ],
    },
    {
      title: 'Your PayMongo account',
      paragraphs: [
        // PLACEHOLDER: how venues' PayMongo keys are stored and used (court-booking-system SAAS-PLAN Phase 4, §4 question 6).
        'If you connect your own PayMongo account, we use its key only to create checkouts for your bookings, to set up PayMongo’s payment notices to us, and to refund late payments as above. [How the key is stored and protected, and what we do if it leaks: to be decided.]',
      ],
    },
    {
      title: 'Invoices',
      paragraphs: [
        'Early each month we send one invoice for the booking fees of the month before, with every booking listed. Your admin pages also show the month so far.',
        'You pay the invoice by GCash or bank transfer within 7 days.',
      ],
    },
    {
      title: 'Late payment',
      paragraphs: [
        'If an invoice is still unpaid after the 7 days, we may suspend your booking page. While it is suspended, it takes no new bookings; bookings already made are still honored, and your admin pages keep working.',
        // PLACEHOLDER: how a suspension ends.
        '[How a suspension is lifted: to be decided.]',
      ],
    },
    {
      title: 'Changes to the fee',
      paragraphs: [
        // PLACEHOLDER: the notice period before a fee change.
        'We tell you before the booking fee changes, at least [notice period, to be decided] ahead. A change applies only to bookings made after it takes effect.',
      ],
    },
    {
      title: 'Your data',
      paragraphs: [
        'Your venue’s bookings and payments are yours. You can export them to CSV from your admin pages.',
      ],
    },
    {
      title: 'Leaving Plotline',
      paragraphs: [
        // PLACEHOLDER: exit terms (SPEC §7).
        '[To be decided: the notice to leave, what happens to unpaid invoices, and whether you can still export your data after you leave.]',
      ],
    },
    {
      title: 'Law',
      paragraphs: [
        // PLACEHOLDER: confirm with the legal review.
        'These terms follow the laws of the Philippines.',
      ],
    },
  ],
})

export const privacy = (supportEmail: string): LegalPage => ({
  title: 'Privacy notice',
  updated: 'October 2026',
  intro: `This notice covers this website (plotline.fit) and its two forms: the contact form and the review form. It follows the Philippine Data Privacy Act of 2012. The personal information controller is ${provider}. Questions or requests: ${supportEmail}.`,
  sections: [
    {
      title: 'What we collect',
      list: [
        'Contact form: your first and last name, email, mobile number, venue name, city or town, number of courts, and, if you add them, your Facebook page and your message. We also keep the time you agreed to be contacted.',
        'Review form: your name, your venue if you add it, your review, whether you are a player or an owner, your star rating, and the time you agreed to have it shown.',
        'Both forms use Cloudflare Turnstile to check that a person is sending them. Cloudflare processes technical details of your browser and connection for that check.',
      ],
    },
    {
      title: 'Why',
      list: [
        'Contact form: to reply to you and talk about setting up your venue. We use it for nothing else.',
        'Review form: to show your review on this site once we approve it, with the name you give, whether you are a player or an owner, your venue if you add it, and your rating.',
        'We rely on your consent, which you give with the checkbox on each form. You can withdraw it at any time.',
      ],
    },
    {
      title: 'Who sees it',
      paragraphs: [
        // PLACEHOLDER: name the email provider once it's chosen (court-booking-system SAAS-PLAN Phase 0).
        'Contact form: only the Plotline team. A new contact form reaches us by email through our email provider [to be named].',
        'Reviews: once we approve a review, it is public. Anyone visiting this site can see the name you gave, whether you are a player or an owner, your venue if you added it, your rating and your review. Reviews we haven’t approved are seen only by the Plotline team.',
        'Both are stored with Supabase, on servers in Singapore. We never sell your information or share it for marketing.',
      ],
    },
    {
      title: 'How long we keep it',
      list: [
        // PLACEHOLDER: retention periods.
        'Contact form: while we talk with you, and for [period, to be decided] after our last contact if your venue doesn’t join. If it joins, we keep what we need to run your account.',
        'Reviews: for as long as we show them, or until you ask us to remove yours.',
      ],
    },
    {
      title: 'Your rights',
      paragraphs: [
        `You can ask to see, correct or delete your information, object to how we use it, or withdraw your consent. Email ${supportEmail}. You can also complain to the National Privacy Commission (privacy.gov.ph).`,
      ],
    },
    {
      title: 'Cookies',
      paragraphs: ['This site uses no analytics or advertising cookies.'],
    },
  ],
})
