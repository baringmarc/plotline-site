// T6.4 Player view: the route (TASKS.md T6.4: `/paddle-stack/live/<code>`, lazy-loaded).
// Plan names: the lazy route `paddle-stack/live/:code` in src/routes/router.tsx, loading `PlayerView` from
// src/features/stack/live/PlayerView.tsx through a dynamic import. The live API is mocked (never the network).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../config/site'
import routerSource from './router.tsx?raw'
import { router } from './router'

const getLiveStack = vi.fn()
const subscribeLiveStack = vi.fn()

vi.mock('../features/stack/live/api', async () => {
  const actual = await vi.importActual<typeof import('../features/stack/live/api')>('../features/stack/live/api')
  return {
    ...actual,
    getLiveStack: (...a: unknown[]) => getLiveStack(...a),
    subscribeLiveStack: (...a: unknown[]) => subscribeLiveStack(...a),
    publishLiveStack: vi.fn(),
    goLive: vi.fn(),
  }
})

function findRoute(routes: RouteObject[], path: string): RouteObject | undefined {
  for (const r of routes) {
    if (r.path === path) return r
    const child = r.children && findRoute(r.children, path)
    if (child) return child
  }
}

beforeEach(() => {
  getLiveStack.mockReset()
  subscribeLiveStack.mockReset()
  subscribeLiveStack.mockReturnValue(() => {})
})

describe('router: /paddle-stack/live/:code (T6.4)', () => {
  it('has a lazy paddle-stack/live/:code route (nothing loaded up front)', () => {
    const route = findRoute(router.routes as RouteObject[], 'paddle-stack/live/:code')
    expect(route, 'paddle-stack/live/:code route').toBeDefined()
    expect(route!.lazy).toBeDefined()
    expect(route!.element).toBeUndefined()
    expect(route!.Component).toBeUndefined()
  })

  it('imports PlayerView only through a dynamic import', () => {
    expect(routerSource).not.toMatch(/^\s*import\s[^\n]*from\s+['"][^'"]*features\/stack/m)
    expect(routerSource).toMatch(/import\(\s*['"][^'"]*features\/stack\/live\/PlayerView['"]\s*\)/)
  })

  it('keeps /paddle-stack on the Stack page', async () => {
    const memory = createMemoryRouter(router.routes as RouteObject[], { initialEntries: ['/paddle-stack'] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={memory} />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: paddleStack.title })).toBeInTheDocument()
  })

  it('renders the player view for the code in the URL', async () => {
    getLiveStack.mockResolvedValue(null)
    const memory = createMemoryRouter(router.routes as RouteObject[], { initialEntries: ['/paddle-stack/live/AbC_123-x'] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={memory} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(paddleStack.viewer.notFound)).toBeInTheDocument()
    expect(getLiveStack).toHaveBeenCalledWith('AbC_123-x')
  })
})
