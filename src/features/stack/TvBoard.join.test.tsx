// T6.6 Join QR on the TV board (TASKS.md T6.6; SPEC §3 `/paddle-stack` row, the slot "kept for Milestone 6's join QR").
// While live, the TV board's bottom slot (`.stack-tv-qr`) shows the join QR and the short link; otherwise it stays empty.
//
// Structure the tests rely on (the plan's names):
// - `TvBoard({ session, nowOn, onExit, joinCode })`, `joinCode?: string | null`;
// - with a code: inside `.stack-tv-qr`, `paddleStack.tv.join.title`, a canvas labelled `paddleStack.tv.join.qrLabel`
//   drawn by `QrCreator.render({ text: joinUrl(code), ... }, canvas)`, and the text `shortJoinLink(code)`;
// - without a code (absent or null): the slot is there and empty, and nothing is drawn.
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { joinUrl, shortJoinLink } from './live/joinLink'
import { TvBoard } from './TvBoard'
import type { Session } from './types'

// qr-creator draws on a real canvas, which jsdom lacks.
const qrRender = vi.fn()
vi.mock('qr-creator', () => ({ default: { render: (...a: unknown[]) => qrRender(...a) } }))

const { tv } = paddleStack
const NAMES = ['Andrew', 'Maria', 'Juan', 'Jose', 'Ana', 'Ben']

function session(): Session {
  return fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES }))
}

function renderTv(joinCode?: string | null) {
  const props = joinCode === undefined ? {} : { joinCode }
  return render(<TvBoard session={session()} nowOn={null} onExit={vi.fn()} {...props} />)
}

function slot(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('.stack-tv-qr')
  expect(el, 'the bottom slot .stack-tv-qr').not.toBeNull()
  return el!
}

/** The calls to QrCreator.render that drew on `canvas`. */
const drawsOn = (canvas: Element) => qrRender.mock.calls.filter((c) => c[1] === canvas)

beforeEach(() => {
  qrRender.mockReset()
})

describe('TvBoard join QR while live (T6.6)', () => {
  it('with a join code, the bottom slot shows the title, the QR canvas and the short link', () => {
    const { container } = renderTv('PAGECODE')
    const qr = slot(container)
    expect(qr).toHaveTextContent(tv.join.title)
    const canvas = within(qr).getByLabelText(tv.join.qrLabel)
    expect(canvas.tagName).toBe('CANVAS')
    expect(qr).toHaveTextContent(shortJoinLink('PAGECODE'))
  })

  it('draws the QR with qr-creator on that canvas, encoding the full join URL', () => {
    const { container } = renderTv('PAGECODE')
    const canvas = within(slot(container)).getByLabelText(tv.join.qrLabel)
    const calls = drawsOn(canvas)
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[calls.length - 1][0]).toMatchObject({ text: joinUrl('PAGECODE') })
    expect(joinUrl('PAGECODE')).toBe(`${window.location.origin}/paddle-stack/live/PAGECODE`)
  })

  it('shows the short link without the protocol, not the full URL', () => {
    const { container } = renderTv('PAGECODE')
    const qr = slot(container)
    expect(within(qr).getByText(shortJoinLink('PAGECODE'), { exact: false })).toBeInTheDocument()
    expect(qr).not.toHaveTextContent(`${window.location.protocol}//`)
  })

  it('the slot is not hidden from screen readers while it shows the QR', () => {
    const { container } = renderTv('PAGECODE')
    expect(slot(container)).not.toHaveAttribute('aria-hidden', 'true')
  })

  it('adds no controls: Exit is still the only button', () => {
    renderTv('PAGECODE')
    expect(screen.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual([tv.exit])
  })
})

describe('TvBoard without a join code (T6.6: QR only while live)', () => {
  it.each([
    ['no joinCode prop', undefined],
    ['joinCode null', null],
  ])('%s: the slot is there and empty, and nothing is drawn', (_label, code) => {
    const { container } = renderTv(code)
    const qr = slot(container)
    expect(qr).toBeEmptyDOMElement()
    expect(screen.queryByLabelText(tv.join.qrLabel)).not.toBeInTheDocument()
    expect(screen.queryByText(tv.join.title)).not.toBeInTheDocument()
    expect(container).not.toHaveTextContent('/paddle-stack/live/')
    expect(qrRender).not.toHaveBeenCalled()
  })

  it('an empty string is no code: nothing shows', () => {
    const { container } = renderTv('')
    expect(slot(container)).toBeEmptyDOMElement()
    expect(qrRender).not.toHaveBeenCalled()
  })
})

describe('TvBoard join code changes (T6.6)', () => {
  it('a code that arrives later shows the QR; one that goes removes it', () => {
    const s = session()
    const { container, rerender } = render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} joinCode={null} />)
    expect(slot(container)).toBeEmptyDOMElement()

    rerender(<TvBoard session={s} nowOn={null} onExit={vi.fn()} joinCode="FIRST1" />)
    const canvas = within(slot(container)).getByLabelText(tv.join.qrLabel)
    const calls = drawsOn(canvas)
    expect(calls[calls.length - 1][0]).toMatchObject({ text: joinUrl('FIRST1') })
    expect(slot(container)).toHaveTextContent(shortJoinLink('FIRST1'))

    rerender(<TvBoard session={s} nowOn={null} onExit={vi.fn()} joinCode={null} />)
    expect(slot(container)).toBeEmptyDOMElement()
    expect(screen.queryByLabelText(tv.join.qrLabel)).not.toBeInTheDocument()
  })

  it('a new code redraws the QR with the new URL and shows the new short link', () => {
    const s = session()
    const { container, rerender } = render(<TvBoard session={s} nowOn={null} onExit={vi.fn()} joinCode="FIRST1" />)
    rerender(<TvBoard session={s} nowOn={null} onExit={vi.fn()} joinCode="SECOND2" />)
    const canvas = within(slot(container)).getByLabelText(tv.join.qrLabel)
    const calls = drawsOn(canvas)
    expect(calls[calls.length - 1][0]).toMatchObject({ text: joinUrl('SECOND2') })
    expect(slot(container)).toHaveTextContent(shortJoinLink('SECOND2'))
    expect(slot(container)).not.toHaveTextContent(shortJoinLink('FIRST1'))
  })
})
