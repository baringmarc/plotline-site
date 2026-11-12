// T5.6 Make the stack findable: on `/paddle-stack`, under the tool, a short how-to for organizers (how the three
// formats work, how to run open play with a TV, the paste box) and 3–4 FAQ items. Plan names, in
// src/config/paddleStack.ts (re-exported by site.ts):
// - `guide: { title: string; sections: { title: string; body: string }[] }`
// - `faq: { title: string; items: { q: string; a: string }[] }` with 3 or 4 items.
// StackPage shows them (h2 `guide.title` with each section; h2 `faq.title` with each question as a
// <details>/<summary>) on the start screen and the board, but not in the `?tv=1` TV window.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../config/site'
import { createSession, fillCourts } from './engine'
import { StackPage } from './StackPage'
import { saveStack } from './storage'

vi.mock('./voice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voice')>()
  return { ...actual, canSpeak: vi.fn(() => false), announce: vi.fn(() => true), requestWakeLock: vi.fn(() => Promise.resolve(() => {})) }
})

// Node 25's own `localStorage` global has no methods in this test environment, so use an in-memory one.
class MemoryStorage {
  #items = new Map<string, string>()
  getItem(k: string) {
    return this.#items.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.#items.set(k, String(v))
  }
  removeItem(k: string) {
    this.#items.delete(k)
  }
}

const { guide, faq, tv, start } = paddleStack

function renderPage(path = '/paddle-stack') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <StackPage />
    </MemoryRouter>,
  )
}

function saveBoard() {
  saveStack({ session: fillCourts(createSession({ format: 'fair', courts: 1, names: ['A', 'B', 'C', 'D', 'E'] })), ended: false })
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

function expectGuideAndFaq() {
  const guideHead = screen.getByRole('heading', { level: 2, name: guide.title })
  expect(guideHead).toBeInTheDocument()
  for (const s of guide.sections) {
    expect(screen.getByRole('heading', { name: s.title })).toBeInTheDocument()
    expect(norm(document.body.textContent)).toContain(norm(s.body))
  }
  expect(screen.getByRole('heading', { level: 2, name: faq.title })).toBeInTheDocument()
  const summaries = [...document.querySelectorAll('details > summary')].map((el) => norm(el.textContent))
  for (const item of faq.items) {
    expect(summaries).toContain(norm(item.q))
    const summary = [...document.querySelectorAll('details > summary')].find((el) => norm(el.textContent) === norm(item.q))!
    expect(norm(summary.closest('details')!.textContent)).toContain(norm(item.a))
  }
}

beforeEach(() => {
  const storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('paddleStack guide and FAQ copy (T5.6)', () => {
  it('has a guide title and at least three sections, each with a title and a body', () => {
    expect(guide.title.trim()).not.toBe('')
    expect(guide.sections.length).toBeGreaterThanOrEqual(3)
    for (const s of guide.sections) {
      expect(s.title.trim()).not.toBe('')
      expect(s.body.trim()).not.toBe('')
    }
  })

  it('the guide explains each of the three formats by name', () => {
    const text = guide.sections.map((s) => `${s.title} ${s.body}`).join(' ')
    for (const f of paddleStack.formats) expect(text).toContain(f.label)
  })

  it('the guide covers the paste box and running open play with a TV', () => {
    const text = guide.sections.map((s) => `${s.title} ${s.body}`).join(' ')
    expect(text).toMatch(/paste/i)
    expect(text).toMatch(/\bTV\b/)
  })

  it('has an FAQ title and 3 or 4 items, each with a question and an answer', () => {
    expect(faq.title.trim()).not.toBe('')
    expect(faq.items.length).toBeGreaterThanOrEqual(3)
    expect(faq.items.length).toBeLessThanOrEqual(4)
    for (const item of faq.items) {
      expect(item.q.trim()).not.toBe('')
      expect(item.a.trim()).not.toBe('')
    }
  })
})

describe('StackPage shows the guide and FAQ under the tool (T5.6)', () => {
  it('on the start screen: the guide with every section and the FAQ as <details>/<summary>', () => {
    renderPage()
    expect(screen.getByRole('button', { name: start.submit })).toBeInTheDocument()
    expectGuideAndFaq()
  })

  it('the guide and FAQ come after the tool (under it)', () => {
    renderPage()
    const submit = screen.getByRole('button', { name: start.submit })
    const guideHead = screen.getByRole('heading', { level: 2, name: guide.title })
    const faqHead = screen.getByRole('heading', { level: 2, name: faq.title })
    expect(submit.compareDocumentPosition(guideHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(guideHead.compareDocumentPosition(faqHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('FAQ answers start folded (each <details> closed)', () => {
    renderPage()
    const details = [...document.querySelectorAll('details')].filter((d) =>
      faq.items.some((i) => norm(d.querySelector('summary')?.textContent) === norm(i.q)),
    )
    expect(details).toHaveLength(faq.items.length)
    for (const d of details) expect(d.open).toBe(false)
  })

  it('on the board (a saved session): the guide and FAQ are still shown', () => {
    saveBoard()
    renderPage()
    expect(screen.getByRole('region', { name: `${paddleStack.board.court} 1` })).toBeInTheDocument()
    expectGuideAndFaq()
  })

  it('on the board after starting a stack: the guide and FAQ are still shown', async () => {
    const user = userEvent.setup()
    renderPage()
    const control = screen.getByLabelText(start.courtsLabel)
    if (control.tagName === 'SELECT') await user.selectOptions(control, '1')
    else {
      await user.clear(control)
      await user.type(control, '1')
    }
    const box = screen.getByRole('textbox', { name: start.namesLabel })
    await user.click(box)
    await user.paste('Andrew\nMaria\nJuan\nJose\nAna')
    await user.click(screen.getByRole('button', { name: start.submit }))
    expect(screen.getByRole('region', { name: `${paddleStack.board.court} 1` })).toBeInTheDocument()
    expectGuideAndFaq()
  })

  it('not in the ?tv=1 TV window', () => {
    saveBoard()
    renderPage('/paddle-stack?tv=1')
    expect(screen.getByText(tv.footer)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: guide.title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: faq.title })).not.toBeInTheDocument()
    for (const item of faq.items) expect(screen.queryByText(item.q)).not.toBeInTheDocument()
    expect(within(document.body).queryAllByText((_, el) => el?.tagName === 'SUMMARY')).toHaveLength(0)
  })
})
