import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { contact } from '../../config/site'
import { ContactForm } from './ContactForm'

const sendContact = vi.fn()
vi.mock('./api', () => ({ sendContact: (p: unknown) => sendContact(p) }))

// Cloudflare's widget, replaced by a button that hands over a token; resets are counted.
const resets = vi.fn()
vi.mock('../../components/Turnstile', () => ({
  Turnstile: ({
    onToken,
    resetSignal,
    onLoadError,
  }: {
    onToken: (t: string) => void
    resetSignal: number
    onLoadError: () => void
  }) => {
    if (resetSignal > 0) resets(resetSignal)
    return (
      <>
        <button type="button" onClick={() => onToken(`token-${resetSignal}`)}>
          Pass the check
        </button>
        <button type="button" onClick={onLoadError}>
          Fail to load
        </button>
      </>
    )
  },
}))

function renderForm(siteKey = 'site-key') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContactForm siteKey={siteKey} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  const t = contact.fields
  await user.type(screen.getByLabelText(t.firstName), 'Ana')
  await user.type(screen.getByLabelText(t.lastName), 'Reyes')
  await user.type(screen.getByLabelText(t.email), 'ana@example.com')
  await user.type(screen.getByLabelText(t.phone), '0917 123 4567')
  await user.type(screen.getByLabelText(t.venueName), 'Sample Pickle Park')
  await user.type(screen.getByLabelText(t.location), 'Pasig')
  await user.type(screen.getByLabelText(t.courts), '3')
  await user.click(screen.getByLabelText(new RegExp(contact.consentBefore)))
}

const submit = () => screen.getByRole('button', { name: new RegExp(contact.submit) })

describe('ContactForm', () => {
  beforeEach(() => {
    sendContact.mockReset()
    resets.mockReset()
  })

  it('shows the validation message and does not send an incomplete form', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(submit())
    expect(screen.getByRole('alert')).toHaveTextContent('first and last name')
    expect(sendContact).not.toHaveBeenCalled()
  })

  it('asks for the human check before sending', async () => {
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(submit())
    expect(screen.getByRole('alert')).toHaveTextContent(contact.turnstileNeeded)
    expect(sendContact).not.toHaveBeenCalled()
  })

  it('sends the PLATFORM.md fields with the token and shows the thank-you state', async () => {
    sendContact.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await user.click(submit())
    expect(await screen.findByRole('heading', { name: contact.thanksTitle })).toBeInTheDocument()
    const payload = sendContact.mock.calls[0][0]
    expect(Object.keys(payload).sort()).toEqual(
      [
        'consent',
        'courts',
        'email',
        'facebook',
        'firstName',
        'lastName',
        'location',
        'message',
        'phone',
        'started',
        'turnstileToken',
        'venueName',
        'website',
      ].sort(),
    )
    expect(payload).toMatchObject({ courts: 3, consent: true, website: '', turnstileToken: 'token-0' })
    expect(payload.started).toBeGreaterThan(0)
  })

  it.each([
    ['a validation error (400)', 'Please enter a valid email address.'],
    ['a failed human check (403)', 'We could not check that you are human. Please try again.'],
    ['the form being off (503)', 'The contact form is unavailable right now. Please message us instead.'],
    ['a server error (500)', 'We could not send your message. Please try again.'],
    ['no connection', 'Network problem. Please check your connection and try again.'],
  ])('shows the reply for %s, gets a fresh token and lets the owner try again', async (_, message) => {
    sendContact.mockImplementation(() => Promise.reject(new Error(message)))
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await user.click(submit())
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(resets).toHaveBeenCalled()
    expect(submit()).toBeEnabled()
  })

  it('says so when the check fails to load, with a way to reach us, and sends nothing', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: 'Fail to load' }))
    expect(screen.getByRole('alert')).toHaveTextContent(contact.turnstileFailed)
    expect(screen.getByRole('link', { name: contact.messageUs })).toBeInTheDocument()
    await fillValid(user)
    await user.click(submit())
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(sendContact).not.toHaveBeenCalled()
  })

  it('sends without a token when no site key is set', async () => {
    sendContact.mockResolvedValue({ ok: true })
    const user = userEvent.setup()
    renderForm('')
    expect(screen.queryByRole('button', { name: 'Pass the check' })).toBeNull()
    await fillValid(user)
    await user.click(submit())
    expect(await screen.findByRole('heading', { name: contact.thanksTitle })).toBeInTheDocument()
    expect(sendContact.mock.calls[0][0]).not.toHaveProperty('turnstileToken')
  })

  it('links the consent to the privacy notice and has no trial wording', () => {
    const { container } = renderForm()
    expect(screen.getByRole('link', { name: contact.consentLink })).toHaveAttribute('href', '/privacy')
    expect(container.textContent).not.toMatch(/trial|password|sign[ -]?up/i)
  })
})
