// T6.2 Organizer goes live: the panel on the board (TASKS.md T6.2). Names from the approved plan:
// `GoLivePanel({ session, live })` with `live: LiveController` from ./useLiveStack. All copy from
// `paddleStack.live` (src/config/paddleStack.ts, re-exported by src/config/site.ts).
// - No key: Go live button and its intro; a click shows the Turnstile widget and `checking`; a non-empty token calls
//   live.goLive(token, session) and hides the widget; each click mounts a new widget (a fresh token each time); an
//   empty token or a load error shows `checkFailed` and doesn't call goLive.
// - Key present: the players' link `${origin}/paddle-stack/live/<code>` in a read-only field (`linkLabel`), a canvas
//   QR (`qrLabel`, drawn by qr-creator with that URL), a status line (`status.label`) and, when stopped, the reason.
// - live.error shows `errors[error]`; `unavailable` keeps the Go live button available.
// - Copy link copies the link (label stays `copyLink`).
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts } from '../engine'
import type { Session } from '../types'
import type { LiveErrorCode } from './api'
import { GoLivePanel } from './GoLivePanel'
import type { LiveStatus } from './publisher'
import type { LiveController } from './useLiveStack'

const { live: copy } = paddleStack

// qr-creator draws on a real canvas, which jsdom lacks.
const qrRender = vi.fn()
vi.mock('qr-creator', () => ({ default: { render: (...a: unknown[]) => qrRender(...a) } }))

// Cloudflare's widget, replaced by buttons. Every mount is a new widget with its own token: token-1, token-2, ...
let mounts = 0
vi.mock('../../../components/Turnstile', async () => {
  const { useState } = await import('react')
  return {
  Turnstile: ({ onToken, onLoadError }: { onToken: (t: string) => void; onLoadError: () => void }) => {
    const [id] = useState(() => ++mounts)
    return (
      <div data-testid="turnstile">
        <button type="button" onClick={() => onToken(`token-${id}`)}>
          Pass the check
        </button>
        <button type="button" onClick={() => onToken('')}>
          Expire the check
        </button>
        <button type="button" onClick={onLoadError}>
          Fail to load
        </button>
      </div>
    )
  },
  }
})

function session(): Session {
  return fillCourts(
    createSession({ format: 'fair', courts: 2, title: 'Tuesday Open Play', names: ['Ana', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay'] }),
  )
}

function controller(over: Partial<LiveController> = {}): LiveController {
  return {
    key: null,
    status: null,
    error: null,
    goLive: vi.fn(async () => {}),
    submit: vi.fn(),
    end: vi.fn(),
    forget: vi.fn(),
    ...over,
  }
}

const KEY = { code: 'CODE123', secret: 'SECRET456', version: 3 }
const linkFor = (code: string) => `${window.location.origin}/paddle-stack/live/${code}`

beforeEach(() => {
  mounts = 0
  qrRender.mockReset()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('GoLivePanel: not live yet (T6.2)', () => {
  it('shows the Go live button and its intro from config, and no widget yet', () => {
    render(<GoLivePanel session={session()} live={controller()} />)
    expect(screen.getByRole('button', { name: copy.goLive })).toBeEnabled()
    expect(screen.getByText(copy.goLiveIntro)).toBeInTheDocument()
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument()
    expect(screen.queryByText(copy.checking)).not.toBeInTheDocument()
  })

  it('clicking Go live shows the human check and the checking text', async () => {
    const user = userEvent.setup()
    render(<GoLivePanel session={session()} live={controller()} />)
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    expect(screen.getByTestId('turnstile')).toBeInTheDocument()
    expect(screen.getByText(copy.checking)).toBeInTheDocument()
  })

  it('a token from the check calls live.goLive(token, session) and hides the widget', async () => {
    const user = userEvent.setup()
    const live = controller()
    const s = session()
    render(<GoLivePanel session={s} live={live} />)
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    expect(live.goLive).toHaveBeenCalledTimes(1)
    expect(live.goLive).toHaveBeenCalledWith('token-1', s)
    expect(screen.queryByTestId('turnstile')).not.toBeInTheDocument()
  })

  it('each Go live mounts a new widget, so each try sends a fresh token', async () => {
    const user = userEvent.setup()
    const live = controller()
    const s = session()
    render(<GoLivePanel session={s} live={live} />)
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    expect(screen.getByTestId('turnstile')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pass the check' }))
    expect(live.goLive).toHaveBeenCalledTimes(2)
    expect(live.goLive).toHaveBeenNthCalledWith(1, 'token-1', s)
    expect(live.goLive).toHaveBeenNthCalledWith(2, 'token-2', s)
  })

  it('an empty token (expired or failed check) shows checkFailed and does not go live', async () => {
    const user = userEvent.setup()
    const live = controller()
    render(<GoLivePanel session={session()} live={live} />)
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Expire the check' }))
    expect(screen.getByText(copy.checkFailed)).toBeInTheDocument()
    expect(live.goLive).not.toHaveBeenCalled()
  })

  it('a widget that fails to load shows checkFailed and does not go live', async () => {
    const user = userEvent.setup()
    const live = controller()
    render(<GoLivePanel session={session()} live={live} />)
    await user.click(screen.getByRole('button', { name: copy.goLive }))
    await user.click(screen.getByRole('button', { name: 'Fail to load' }))
    expect(screen.getByText(copy.checkFailed)).toBeInTheDocument()
    expect(live.goLive).not.toHaveBeenCalled()
  })
})

describe('GoLivePanel: errors from going live (T6.2)', () => {
  it.each(Object.keys(copy.errors) as (keyof typeof copy.errors)[])('error %s shows its message from config', (code) => {
    render(<GoLivePanel session={session()} live={controller({ error: code as LiveErrorCode })} />)
    expect(screen.getByText(copy.errors[code])).toBeInTheDocument()
  })

  it('unavailable says Go live is off and the Go live button stays available', () => {
    render(<GoLivePanel session={session()} live={controller({ error: 'unavailable' })} />)
    expect(screen.getByText(copy.errors.unavailable)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.goLive })).toBeEnabled()
  })

  it('no error message shows when error is null', () => {
    render(<GoLivePanel session={session()} live={controller()} />)
    for (const text of new Set(Object.values(copy.errors))) expect(screen.queryByText(text)).not.toBeInTheDocument()
  })
})

describe('GoLivePanel: live (T6.2)', () => {
  it('shows the players’ link in a read-only field labelled linkLabel', () => {
    render(<GoLivePanel session={session()} live={controller({ key: KEY, status: { state: 'live' } })} />)
    const field = screen.getByLabelText(copy.linkLabel) as HTMLInputElement
    expect(field.value).toBe(linkFor('CODE123'))
    expect(field.readOnly).toBe(true)
  })

  it('the link never contains the secret', () => {
    const { container } = render(<GoLivePanel session={session()} live={controller({ key: KEY, status: { state: 'live' } })} />)
    expect(container.innerHTML).not.toContain(KEY.secret)
    expect((screen.getByLabelText(copy.linkLabel) as HTMLInputElement).value).not.toContain(KEY.secret)
  })

  it('draws the QR for the link on a canvas labelled qrLabel', () => {
    render(<GoLivePanel session={session()} live={controller({ key: KEY, status: { state: 'live' } })} />)
    const canvas = screen.getByLabelText(copy.qrLabel)
    expect(canvas.tagName).toBe('CANVAS')
    expect(qrRender).toHaveBeenCalled()
    expect(qrRender).toHaveBeenLastCalledWith(expect.objectContaining({ text: linkFor('CODE123') }), canvas)
  })

  it.each<[LiveStatus, string]>([
    [{ state: 'live' }, copy.status.live],
    [{ state: 'reconnecting' }, copy.status.reconnecting],
    [{ state: 'stopped', reason: 'forbidden' }, copy.status.stopped],
  ])('the status line (status.label) shows the text for %o', (status, text) => {
    render(<GoLivePanel session={session()} live={controller({ key: KEY, status })} />)
    expect(screen.getByLabelText(copy.status.label)).toHaveTextContent(text)
  })

  it.each(Object.keys(copy.stopped) as (keyof typeof copy.stopped)[])(
    'stopped with %s shows its plain message from config',
    (reason) => {
      render(<GoLivePanel session={session()} live={controller({ key: KEY, status: { state: 'stopped', reason } })} />)
      expect(screen.getByLabelText(copy.status.label)).toHaveTextContent(copy.status.stopped)
      expect(screen.getByText(copy.stopped[reason])).toBeInTheDocument()
    },
  )

  it('Copy link copies the players’ link and keeps its label', () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<GoLivePanel session={session()} live={controller({ key: KEY, status: { state: 'live' } })} />)
    fireEvent.click(screen.getByRole('button', { name: copy.copyLink }))
    expect(writeText).toHaveBeenCalledWith(linkFor('CODE123'))
    expect(screen.getByRole('button', { name: copy.copyLink })).toBeInTheDocument()
  })
})
