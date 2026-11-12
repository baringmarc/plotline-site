// T5.3 route: `/paddle-stack` is lazy-loaded so the landing page's first load doesn't grow.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { paddleStack } from '../config/site'
import routerSource from './router.tsx?raw'
import { router } from './router'

function findRoute(routes: RouteObject[], path: string): RouteObject | undefined {
  for (const r of routes) {
    if (r.path === path) return r
    const child = r.children && findRoute(r.children, path)
    if (child) return child
  }
}

describe('router: /paddle-stack (T5.3)', () => {
  it('has a paddle-stack route that is lazy (no element or Component loaded up front)', () => {
    const route = findRoute(router.routes as RouteObject[], 'paddle-stack') ?? findRoute(router.routes as RouteObject[], '/paddle-stack')
    expect(route, 'paddle-stack route').toBeDefined()
    expect(route!.lazy).toBeDefined()
    expect(route!.element).toBeUndefined()
    expect(route!.Component).toBeUndefined()
  })

  it('does not import the stack feature statically (only through a dynamic import)', () => {
    expect(routerSource).not.toMatch(/^\s*import\s[^\n]*from\s+['"][^'"]*features\/stack/m)
    expect(routerSource).not.toMatch(/^\s*import\s+['"][^'"]*features\/stack/m)
    expect(routerSource).toMatch(/import\(\s*['"][^'"]*features\/stack\/StackPage['"]\s*\)/)
  })

  it('renders the Stack page at /paddle-stack inside the site layout', async () => {
    const memory = createMemoryRouter(router.routes as RouteObject[], { initialEntries: ['/paddle-stack'] })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={memory} />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: paddleStack.title })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
