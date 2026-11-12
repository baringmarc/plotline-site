// The lazy /paddle-stack route's loading and error states (T5.3 review): a failed chunk fetch shows our own
// message and a reload button, not React Router's default error screen.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { routeStatus } from '../config/site'
import { router } from './router'
import { RouteError, RouteLoading } from './SimplePages'

function stackRoute(): RouteObject {
  const layout = router.routes[0] as RouteObject
  return layout.children!.find((r) => r.path === 'paddle-stack')!
}

describe('lazy route states', () => {
  it('the paddle-stack route declares a loading fallback and an error element', () => {
    const r = stackRoute()
    expect(r.hydrateFallbackElement).toBeDefined()
    expect(r.errorElement).toBeDefined()
  })

  it('shows the loading line', () => {
    render(<RouteLoading />)
    expect(screen.getByRole('status')).toHaveTextContent(routeStatus.loading)
  })

  it('shows our message and reloads when the page file fails to load', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const memory = createMemoryRouter(
      [{ path: '/paddle-stack', lazy: () => Promise.reject(new Error('chunk failed')), errorElement: <RouteError /> }],
      { initialEntries: ['/paddle-stack'] },
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<RouterProvider router={memory} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(routeStatus.failed)
    await userEvent.setup().click(screen.getByRole('button', { name: routeStatus.reload }))
    expect(reload).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
