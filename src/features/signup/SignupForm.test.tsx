import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignupForm } from './SignupForm'

const registerVenue = vi.fn()
vi.mock('./api', () => ({ registerVenue: (p: unknown) => registerVenue(p) }))

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SignupForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('First name'), 'Ana')
  await user.type(screen.getByLabelText('Last name'), 'Reyes')
  await user.type(screen.getByLabelText('Email'), 'ana@example.com')
  await user.type(screen.getByLabelText('Mobile number'), '09171234567')
  await user.type(screen.getByLabelText('Venue name'), 'Sample Pickle Park')
  await user.type(screen.getByLabelText('City or town'), 'Pasig')
  await user.type(screen.getByLabelText('Password'), 'correct horse')
  await user.type(screen.getByLabelText('Repeat password'), 'correct horse')
  await user.click(screen.getByLabelText(/I agree to the/))
  await user.click(screen.getByLabelText(/I own or manage/))
}

describe('SignupForm', () => {
  beforeEach(() => {
    registerVenue.mockReset()
  })

  it('shows the validation message and does not send an incomplete form', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /Start my free trial/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('first and last name')
    expect(registerVenue).not.toHaveBeenCalled()
  })

  it('sends a valid form and shows the check-your-email message', async () => {
    registerVenue.mockResolvedValue({ ok: true, email: 'ana@example.com' })
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /Start my free trial/ }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(registerVenue).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com', courts: 2, website: '' }))
    expect(registerVenue.mock.calls[0][0].started).toBeGreaterThan(0)
  })

  it('shows the server error and lets the owner try again', async () => {
    registerVenue.mockImplementation(() => Promise.reject(new Error('Too many sign-ups right now.')))
    const user = userEvent.setup()
    renderForm()
    await fillValid(user)
    await user.click(screen.getByRole('button', { name: /Start my free trial/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-ups')
    expect(screen.getByRole('button', { name: /Start my free trial/ })).toBeEnabled()
  })
})
