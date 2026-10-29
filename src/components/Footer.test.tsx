import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { site } from '../config/site'
import { Footer } from './Footer'

describe('Footer', () => {
  it('shows the Facebook link only once the page is set', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('link', { name: 'Facebook' }) !== null).toBe(Boolean(site.facebookUrl))
    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute('href', `mailto:${site.supportEmail}`)
  })

  it('shows the Facebook link to Plotline’s page (T1.11a)', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
      'href',
      'https://www.facebook.com/profile.php?id=61595759948011',
    )
    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute('href', 'mailto:plotline.admin1@gmail.com')
  })
})
