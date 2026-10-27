import { act, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TurnstileApi } from '../lib/turnstile'
import { Turnstile } from './Turnstile'

type Options = Parameters<TurnstileApi['render']>[1]

/** A stand-in for Cloudflare's script, already loaded on `window`. */
function stubApi() {
  const calls = { options: null as Options | null }
  const api = {
    render: vi.fn((_el: HTMLElement, options: Options) => {
      calls.options = options
      return 'w1'
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  window.turnstile = api
  return { api, calls }
}

afterEach(() => {
  delete window.turnstile
})

describe('Turnstile', () => {
  it('renders with the site key, follows the theme and passes tokens up', async () => {
    const { api, calls } = stubApi()
    const onToken = vi.fn()
    render(<Turnstile siteKey="key-1" onToken={onToken} resetSignal={0} onLoadError={vi.fn()} />)
    await waitFor(() => expect(api.render).toHaveBeenCalled())
    expect(calls.options).toMatchObject({ sitekey: 'key-1', theme: 'auto', size: 'flexible' })

    act(() => calls.options?.callback('tok'))
    expect(onToken).toHaveBeenLastCalledWith('tok')
    act(() => calls.options?.['expired-callback']())
    expect(onToken).toHaveBeenLastCalledWith('')
  })

  it('resets for a fresh token when asked, and removes the widget on unmount', async () => {
    const { api } = stubApi()
    const onToken = vi.fn()
    const { rerender, unmount } = render(
      <Turnstile siteKey="key-1" onToken={onToken} resetSignal={0} onLoadError={vi.fn()} />,
    )
    await waitFor(() => expect(api.render).toHaveBeenCalled())

    rerender(<Turnstile siteKey="key-1" onToken={onToken} resetSignal={1} onLoadError={vi.fn()} />)
    expect(api.reset).toHaveBeenCalledWith('w1')
    expect(onToken).toHaveBeenLastCalledWith('')

    unmount()
    expect(api.remove).toHaveBeenCalledWith('w1')
  })
})

describe('Turnstile without Cloudflare', () => {
  it('reports a script that fails to load', async () => {
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      ;(node as HTMLScriptElement).onerror?.(new Event('error'))
      return node
    })
    const onLoadError = vi.fn()
    render(<Turnstile siteKey="key-1" onToken={vi.fn()} resetSignal={0} onLoadError={onLoadError} />)
    await waitFor(() => expect(onLoadError).toHaveBeenCalled())
    append.mockRestore()
  })
})
