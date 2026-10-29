import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../cardsApi'
import { makeCard } from '../test/fixtures'
import type { CardData } from '../types'
import Board from './Board'

vi.mock('../cardsApi')
const mocked = vi.mocked(api)

function renderBoard(cards: CardData[] = []) {
  mocked.fetchCards.mockResolvedValue(cards)
  return render(<Board userId="user-1" email="sam@example.com" />)
}

const region = (name: string) => screen.getByRole('region', { name })
const liveRegion = () => document.querySelector('[aria-live="polite"]') as HTMLElement

beforeEach(() => {
  mocked.createCard.mockImplementation(async (fields, column) => ({ id: 'new-1', ...fields, column }))
  mocked.updateCard.mockResolvedValue(undefined)
  mocked.moveCardTo.mockResolvedValue(undefined)
  mocked.deleteCardById.mockResolvedValue(undefined)
})

describe('Board: structure and names (WCAG 1.3.1, 2.4.1, 2.4.6)', () => {
  it('has banner and main landmarks, one h1, and a skip link to the board', async () => {
    renderBoard()
    await screen.findByRole('heading', { name: 'My Board' })
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Skip to board' })).toHaveAttribute('href', '#main')
  })

  it('names every column and gives each Add card button a distinct label', async () => {
    renderBoard()
    await screen.findByRole('heading', { name: 'My Board' })
    for (const name of ['Backlog', 'In Progress', 'In Review', 'Done']) {
      expect(region(name)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: `Add card to ${name}` })).toBeInTheDocument()
    }
  })

  it('announces what each count counts, and lists cards as a list', async () => {
    renderBoard([makeCard({ column: 'done' }), makeCard({ column: 'done' }), makeCard({ column: 'backlog' })])
    await within(region('Done')).findByRole('list')
    expect(region('Done')).toHaveTextContent(/2\s+cards/)
    expect(region('Backlog')).toHaveTextContent(/1\s+card(?!s)/)
    expect(within(region('Done')).getAllByRole('listitem')).toHaveLength(2)
  })

  it('exposes the signed-in user as text, not only a tooltip', async () => {
    renderBoard()
    expect(await screen.findByText('Signed in as sam@example.com')).toBeInTheDocument()
  })

  it('renders the due date as a machine-readable, human-friendly <time>', async () => {
    renderBoard([makeCard({ dueDate: '2026-11-05' })])
    const time = await screen.findByText(/^Due /)
    expect(time.tagName).toBe('TIME')
    expect(time).toHaveAttribute('datetime', '2026-11-05')
    expect(time).not.toHaveTextContent('2026-11-05')
  })
})

describe('Board: loading state (UX audit, WCAG 4.1.3)', () => {
  it('shows a loading placeholder and announces it, instead of an empty board', async () => {
    let finish!: (cards: CardData[]) => void
    mocked.fetchCards.mockReturnValue(new Promise((r) => (finish = r)))
    render(<Board userId="user-1" email="sam@example.com" />)

    expect(liveRegion()).toHaveTextContent('Loading cards…')
    expect(screen.queryByText(/Drop a card here/)).not.toBeInTheDocument()

    await act(async () => finish([]))
    expect(screen.getAllByText(/Drop a card here/)).toHaveLength(4)
    expect(liveRegion()).not.toHaveTextContent('Loading cards…')
  })
})

describe('Board: dialog focus management (WCAG 2.4.3, 2.1.2)', () => {
  it('makes the page behind the dialog inert while it is open', async () => {
    const user = userEvent.setup()
    renderBoard()
    await screen.findByRole('heading', { name: 'My Board' })
    expect(document.querySelector('[inert]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    expect(document.querySelector('[inert]')).toContainElement(screen.getByRole('main', { hidden: true }))
    await user.keyboard('{Escape}')
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('returns focus to the button that opened the dialog', async () => {
    const user = userEvent.setup()
    renderBoard()
    const add = await screen.findByRole('button', { name: 'Add card to Done' })
    await user.click(add)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(add).toHaveFocus())
  })

  it('falls back to the page heading when the opener card was deleted', async () => {
    const user = userEvent.setup()
    renderBoard([makeCard({ title: 'Temp' })])
    await user.click(await screen.findByRole('button', { name: 'Edit Temp' }))
    await user.click(screen.getByRole('button', { name: 'Delete card' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'My Board' })).toHaveFocus())
  })
})

describe('Board: announcements (WCAG 4.1.3)', () => {
  it('announces adding, saving and moving cards', async () => {
    const user = userEvent.setup()
    renderBoard([makeCard({ id: 'a', title: 'Existing', column: 'backlog' })])

    await user.click(await screen.findByRole('button', { name: 'Add card to Done' }))
    await user.type(screen.getByLabelText(/Name/), 'Fresh')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Added Fresh to Done'))

    await user.click(screen.getByRole('button', { name: 'Edit Existing' }))
    await user.selectOptions(screen.getByLabelText('Column'), 'in-review')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Saved Existing'))
  })
})

describe('Board: undo toast timing (WCAG 2.2.1)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function deleteFirstCard() {
    renderBoard([makeCard({ title: 'Timed' })])
    await act(async () => void (await vi.advanceTimersByTimeAsync(0)))
    fireEvent.click(screen.getByRole('button', { name: 'Delete Timed' }))
  }

  it('stays for 10 seconds, then disappears', async () => {
    await deleteFirstCard()
    expect(screen.getByText('Deleted “Timed”')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(9_900))
    expect(screen.getByText('Deleted “Timed”')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(200))
    expect(screen.queryByText('Deleted “Timed”')).not.toBeInTheDocument()
  })

  it('pauses while hovered and resumes afterwards', async () => {
    await deleteFirstCard()
    const toast = screen.getByText('Deleted “Timed”').parentElement as HTMLElement
    fireEvent.mouseEnter(toast)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Deleted “Timed”')).toBeInTheDocument()
    fireEvent.mouseLeave(toast)
    act(() => void vi.advanceTimersByTime(10_100))
    expect(screen.queryByText('Deleted “Timed”')).not.toBeInTheDocument()
  })

  it('can be dismissed without undoing', async () => {
    await deleteFirstCard()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Deleted “Timed”')).not.toBeInTheDocument()
    expect(mocked.createCard).not.toHaveBeenCalled()
  })
})

describe('Board: error banner (UX audit)', () => {
  it('is announced, stays until dismissed, and can be dismissed', async () => {
    mocked.fetchCards.mockRejectedValue(new Error('could not load'))
    render(<Board userId="user-1" email="sam@example.com" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('could not load')
    fireEvent.click(within(alert).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
