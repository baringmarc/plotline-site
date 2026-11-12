// T5.6 Make the stack findable: a footer link to Paddle Stack. Plan names: `stackLink` in src/config/site.ts
// (`{ href: '/paddle-stack', label: 'Paddle Stack' }`), rendered by Footer as a router link.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { stackLink } from '../config/site'
import { Footer } from './Footer'

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.pathname}</output>
}

function renderFooter() {
  return render(
    <MemoryRouter initialEntries={['/terms']}>
      <Routes>
        <Route path="*" element={<><Footer /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Footer: Paddle Stack link (T5.6)', () => {
  it('shows a "Paddle Stack" link to /paddle-stack from stackLink', () => {
    renderFooter()
    expect(stackLink.label).toBe('Paddle Stack')
    expect(screen.getByRole('link', { name: stackLink.label })).toHaveAttribute('href', '/paddle-stack')
  })

  it('is a router link: clicking it goes to /paddle-stack', async () => {
    const user = userEvent.setup()
    renderFooter()
    await user.click(screen.getByRole('link', { name: stackLink.label }))
    expect(screen.getByTestId('where')).toHaveTextContent('/paddle-stack')
  })

  it('keeps Terms and Privacy', () => {
    renderFooter()
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })
})
