import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { nav } from '../config/site'
import { Nav } from './Nav'

describe('Nav', () => {
  it('"Message us" opens Messenger in a new tab (T1.11a)', () => {
    render(
      <MemoryRouter>
        <Nav />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: nav.messenger, hidden: true })
    expect(link).toHaveAttribute('href', 'https://m.me/61595759948011')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
