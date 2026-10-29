// The Terms and the Privacy notice. They follow court-booking-system's SAAS-PLAN §1 and §5 and the "At a glance"
// sheet; what isn't decided yet is marked PLACEHOLDER (SPEC §7, TASKS T1.11b). Have both checked before launch.
import { peso, pricing } from './pricing'

export type LegalSection = { title: string; paragraphs?: string[]; list?: string[] }
export type LegalPage = { title: string; updated: string; intro: string; sections: LegalSection[] }

/** PLACEHOLDER: shown on both pages until the final text is approved. */
export const legalDraftNotice = 'Draft. This page is not final yet and will be reviewed before Plotline launches.'

/** Who runs Plotline: the other party to the Terms and the personal information controller. */
export const provider = 'Plotline'

const fee = peso(pricing.bookingFee)
const notBilled = pricing.notBilled.map((n, i) => (i ? n[0].toLowerCase() + n.slice(1) : n)).join(', ')

export const terms = (supportEmail: string): LegalPage => ({
  title: 'Terms for venues',
  updated: 'October 2026',
  intro: `These terms cover a venue's use of Plotline: an online booking page for your courts and the admin pages to run them. These terms are between your venue and ${provider}. Questions: ${supportEmail}.`,
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
        'If you connect your own PayMongo account, we use its key only to create checkouts for your bookings, to set up PayMongo’s payment notices to us, and to refund late payments as above.',
        'We store the key encrypted, and it is read only by our server. It is never shown again, not even to you: your admin pages show its last 4 characters. If we think the key may have leaked, we disconnect it, tell you right away, and help you replace it with a new key from your PayMongo dashboard.',
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
        'Once the overdue invoice is paid, we lift the suspension, usually within one business day.',
      ],
    },
    {
      title: 'Changes to the fee',
      paragraphs: [
        'We tell you before the booking fee changes, at least 1 week ahead. A change applies only to bookings made after it takes effect.',
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
        'You can leave any time: tell us by email. There is no notice period. We close your booking page, and bookings already made are yours to honor or cancel with your players.',
        'Booking fees for bookings confirmed before you leave go on a final invoice, which you pay within 7 days.',
        'Your admin pages, and the CSV export of your bookings and payments, stay open for 30 days after you leave. Then your venue’s data is deleted, except what the law requires us to keep, such as invoices.',
      ],
    },
    {
      title: 'Law',
      paragraphs: [
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
        'Contact form: only the Plotline team.',
        // PLACEHOLDER: name the service that emails us new leads once it's chosen (court-booking-system SAAS-PLAN Phase 0).
        'A new contact form reaches us by email, sent through our email service [service to be named]. Emails you send us are kept in our Gmail inbox (Google).',
        'Reviews: once we approve a review, it is public. Anyone visiting this site can see the name you gave, whether you are a player or an owner, your venue if you added it, your rating and your review. Reviews we haven’t approved are seen only by the Plotline team.',
        'Both are stored with Supabase, on servers in Singapore. We never sell your information or share it for marketing.',
      ],
    },
    {
      title: 'How long we keep it',
      list: [
        'Contact form: while we talk with you, and for 1 year after our last contact if your venue doesn’t join. If it joins, we keep what we need to run your account.',
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
