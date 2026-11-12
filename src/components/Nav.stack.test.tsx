// T5.6 Make the stack findable: a main-nav link "Paddle Stack" right after "For venue owners" (the user's call,
// 2026-11-12). Plan names: `navLinks` in src/config/site.ts gains `{ href: '/paddle-stack', label: 'Paddle Stack' }`
// (a route, not a `#` anchor); Nav renders it as a router link in the top bar and in the phone menu panel
// (`#menupanel`), while the anchor entries stay `/#…`.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { navLinks, stackLink } from '../config/site'
import { Nav } from './Nav'

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{loc.pathname}</output>
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<><Nav /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  )
}

const topBar = () => screen.getByRole('navigation', { name: 'Main' })
const menuPanel = () => {
  const el = document.getElementById('menupanel')
  if (!el) throw new Error('no #menupanel')
  return el
}

describe('navLinks config (T5.6)', () => {
  it('has a Paddle Stack route entry right after "For venue owners"', () => {
    const i = navLinks.findIndex((l) => l.label === 'For venue owners')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(navLinks[i + 1]).toEqual({ href: '/paddle-stack', label: 'Paddle Stack' })
  })

  it('keeps the other entries as # anchors', () => {
    const others = navLinks.filter((l) => l.label !== 'Paddle Stack')
    expect(others.map((l) => l.href)).toEqual(['#players', '#features', '#pricing', '#faq'])
  })

  it('exports stackLink for the footer with the same route and label', () => {
    expect(stackLink).toEqual({ href: '/paddle-stack', label: 'Paddle Stack' })
  })
})

describe('Nav: Paddle Stack link (T5.6)', () => {
  it('top bar links "Paddle Stack" to /paddle-stack, right after "For venue owners"', () => {
    renderNav()
    const links = within(topBar()).getAllByRole('link', { hidden: true })
    const names = links.map((a) => a.textContent?.trim())
    const i = names.indexOf('For venue owners')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(names[i + 1]).toBe('Paddle Stack')
    expect(links[i + 1]).toHaveAttribute('href', '/paddle-stack')
  })

  it('phone menu panel links "Paddle Stack" to /paddle-stack, right after "For venue owners"', () => {
    renderNav()
    const links = within(menuPanel()).getAllByRole('link', { hidden: true })
    const names = links.map((a) => a.textContent?.trim())
    const i = names.indexOf('For venue owners')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(names[i + 1]).toBe('Paddle Stack')
    expect(links[i + 1]).toHaveAttribute('href', '/paddle-stack')
  })

  it('the anchor links still point at the landing page sections (/#…) in both places', () => {
    renderNav()
    for (const container of [topBar(), menuPanel()]) {
      for (const [label, href] of [
        ['For players', '/#players'],
        ['For venue owners', '/#features'],
        ['Pricing', '/#pricing'],
        ['FAQ', '/#faq'],
      ]) {
        expect(within(container).getByRole('link', { name: label, hidden: true })).toHaveAttribute('href', href)
      }
    }
  })

  it('the top bar link is a router link: clicking it goes to /paddle-stack without a page load', async () => {
    const user = userEvent.setup()
    renderNav()
    expect(screen.getByTestId('where')).toHaveTextContent('/')
    await user.click(within(topBar()).getByRole('link', { name: 'Paddle Stack', hidden: true }))
    expect(screen.getByTestId('where')).toHaveTextContent('/paddle-stack')
  })

  it('the menu panel link is a router link and closes the menu', async () => {
    const user = userEvent.setup()
    renderNav()
    const menu = screen.getByRole('button', { name: 'Menu' })
    await user.click(menu)
    expect(menu).toHaveAttribute('aria-expanded', 'true')
    await user.click(within(menuPanel()).getByRole('link', { name: 'Paddle Stack', hidden: true }))
    expect(screen.getByTestId('where')).toHaveTextContent('/paddle-stack')
    expect(menu).toHaveAttribute('aria-expanded', 'false')
  })
})
