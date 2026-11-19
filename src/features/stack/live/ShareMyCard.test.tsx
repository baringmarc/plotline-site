// T6.5 Share my card on the player view (TASKS.md T6.5: "pick your name, then the T8.7 card is made on the phone";
// Acceptance: "component tests (pick a name, card made from the snapshot)").
// Plan names: `ShareMyCard({ session })` in src/features/stack/live/ShareMyCard.tsx, `session` being the one rebuilt
// with `sessionFromSnapshot`. A button `viewer.myCard.button`, disabled until a game is scored; pressing it shows a
// `<select>` labelled `viewer.myCard.pickLabel` (a placeholder option `viewer.myCard.pickPrompt`, then the standings'
// players, removed players excluded, ordered by name), a `viewer.myCard.make` button and a `viewer.myCard.cancel`
// button. "Make my card" opens the existing `ShareCardDialog` with that session and the picked player's `playerId`;
// the dialog's `onClose` closes it. The dialog is mocked here so the assertion is on what it is given.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paddleStack } from '../../../config/site'
import { createSession, fillCourts, recordScore, removePlayer, skipGame } from '../engine'
import type { Session } from '../types'
import { ShareMyCard } from './ShareMyCard'
import { buildSnapshot, sessionFromSnapshot } from './snapshot'

const dialogProps = vi.hoisted(() => ({ calls: [] as { session: unknown; playerId?: string }[] }))

vi.mock('../shareCards/ShareCardDialog', () => ({
  ShareCardDialog: ({ session, playerId, onClose }: { session: unknown; playerId?: string; onClose: () => void }) => {
    dialogProps.calls.push({ session, playerId })
    return (
      <div role="dialog" aria-label="Share a card (mock)" data-player-id={playerId ?? ''}>
        <button type="button" onClick={onClose}>
          Close mock dialog
        </button>
      </div>
    )
  },
}))

/** Read lazily so a missing key fails the test that uses it, not the whole file. */
const my = () => paddleStack.viewer.myCard

// Joined out of name order on purpose, so "ordered by name" is checked.
const NAMES = ['Maria', 'Ben', 'Andrew', 'Juan', 'Cy', 'Ana']

/** A session as the player view has it: built, published as a snapshot, rebuilt from it. */
function fromSnapshot(s: Session): Session {
  return sessionFromSnapshot(buildSnapshot(s))
}

function started(): Session {
  return fillCourts(createSession({ format: 'fair', courts: 1, names: NAMES, title: 'Tuesday Open Play' }))
}

function scored(): Session {
  const s = started()
  return fillCourts(recordScore(s, s.games.find((g) => g.status === 'playing')!.id, 11, 7))
}

const idOf = (s: Session, name: string) => s.players.find((p) => p.name === name)!.id
const shareBtn = () => screen.getByRole('button', { name: my().button })
const picker = () => screen.getByRole('combobox', { name: my().pickLabel })
const optionTexts = () => within(picker()).getAllByRole('option').map((o) => o.textContent?.trim() ?? '')
const mockDialog = () => screen.queryByRole('dialog', { name: 'Share a card (mock)' })

beforeEach(() => {
  dialogProps.calls = []
})

describe('ShareMyCard: copy (T6.5)', () => {
  it('has the plan’s copy under paddleStack.viewer.myCard', () => {
    expect(my()).toMatchObject({
      button: 'Share my card',
      pickLabel: 'Your name',
      pickPrompt: 'Pick your name',
      make: 'Make my card',
      cancel: 'Cancel',
    })
  })
})

describe('ShareMyCard: the button (T6.5)', () => {
  it('shows a "Share my card" button and no picker or dialog yet', () => {
    render(<ShareMyCard session={fromSnapshot(scored())} />)
    expect(shareBtn()).toBeEnabled()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(mockDialog()).not.toBeInTheDocument()
  })

  it('is disabled until a game in the session is scored', () => {
    render(<ShareMyCard session={fromSnapshot(started())} />)
    expect(shareBtn()).toBeDisabled()
  })

  it('stays disabled when games were only skipped', () => {
    let s = started()
    s = fillCourts(skipGame(s, s.games.find((g) => g.status === 'playing')!.id))
    render(<ShareMyCard session={fromSnapshot(s)} />)
    expect(shareBtn()).toBeDisabled()
  })
})

describe('ShareMyCard: pick your name (T6.5)', () => {
  it('pressing it shows the "Your name" picker with a "Pick your name" prompt and Make my card', async () => {
    const user = userEvent.setup()
    render(<ShareMyCard session={fromSnapshot(scored())} />)
    await user.click(shareBtn())
    expect(picker()).toBeInTheDocument()
    expect(optionTexts()[0]).toBe(my().pickPrompt)
    expect(screen.getByRole('button', { name: my().make })).toBeInTheDocument()
    expect(mockDialog()).not.toBeInTheDocument()
  })

  it('lists every player in the standings, ordered by name', async () => {
    const user = userEvent.setup()
    render(<ShareMyCard session={fromSnapshot(scored())} />)
    await user.click(shareBtn())
    expect(optionTexts().slice(1)).toEqual(['Ana', 'Andrew', 'Ben', 'Cy', 'Juan', 'Maria'])
  })

  it('leaves out removed players', async () => {
    const user = userEvent.setup()
    let s = scored()
    s = removePlayer(s, idOf(s, 'Ben'))
    render(<ShareMyCard session={fromSnapshot(s)} />)
    await user.click(shareBtn())
    expect(optionTexts().slice(1)).toEqual(['Ana', 'Andrew', 'Cy', 'Juan', 'Maria'])
    expect(optionTexts()).not.toContain('Ben')
  })

  it('does not make a card before a name is picked', async () => {
    const user = userEvent.setup()
    render(<ShareMyCard session={fromSnapshot(scored())} />)
    await user.click(shareBtn())
    const make = screen.getByRole('button', { name: my().make })
    if (!make.hasAttribute('disabled')) await user.click(make)
    expect(mockDialog()).not.toBeInTheDocument()
    expect(dialogProps.calls).toHaveLength(0)
  })

  it('Cancel closes the picker without making a card', async () => {
    const user = userEvent.setup()
    render(<ShareMyCard session={fromSnapshot(scored())} />)
    await user.click(shareBtn())
    await user.click(screen.getByRole('button', { name: my().cancel }))
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(mockDialog()).not.toBeInTheDocument()
    expect(shareBtn()).toBeInTheDocument()
  })
})

describe('ShareMyCard: the card is made from the snapshot (T6.5)', () => {
  it('Make my card opens ShareCardDialog with the session it was given and the picked player’s id', async () => {
    const user = userEvent.setup()
    const session = fromSnapshot(scored())
    render(<ShareMyCard session={session} />)
    await user.click(shareBtn())
    await user.selectOptions(picker(), within(picker()).getByRole('option', { name: 'Juan' }))
    await user.click(screen.getByRole('button', { name: my().make }))
    expect(mockDialog()).toBeInTheDocument()
    expect(mockDialog()).toHaveAttribute('data-player-id', idOf(session, 'Juan'))
    const last = dialogProps.calls[dialogProps.calls.length - 1]
    expect(last.session).toBe(session)
    expect(last.playerId).toBe(idOf(session, 'Juan'))
  })

  it('makes the card for whichever name is picked last', async () => {
    const user = userEvent.setup()
    const session = fromSnapshot(scored())
    render(<ShareMyCard session={session} />)
    await user.click(shareBtn())
    await user.selectOptions(picker(), within(picker()).getByRole('option', { name: 'Maria' }))
    await user.selectOptions(picker(), within(picker()).getByRole('option', { name: 'Ana' }))
    await user.click(screen.getByRole('button', { name: my().make }))
    expect(dialogProps.calls[dialogProps.calls.length - 1].playerId).toBe(idOf(session, 'Ana'))
  })

  it('closing the dialog closes it', async () => {
    const user = userEvent.setup()
    const session = fromSnapshot(scored())
    render(<ShareMyCard session={session} />)
    await user.click(shareBtn())
    await user.selectOptions(picker(), within(picker()).getByRole('option', { name: 'Cy' }))
    await user.click(screen.getByRole('button', { name: my().make }))
    await user.click(screen.getByRole('button', { name: 'Close mock dialog' }))
    expect(mockDialog()).not.toBeInTheDocument()
    expect(shareBtn()).toBeInTheDocument()
  })
})
