import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../cardsApi'
import { channelMock, supabaseMock } from '../test/supabaseMock'
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
const editButton = (title: string) => screen.getByRole('button', { name: `Edit ${title}` })

// jsdom has no DataTransfer, so hand the drag events a minimal stand-in.
function dragCard(title: string, toColumn: string) {
  const store: Record<string, string> = {}
  const dataTransfer = {
    effectAllowed: '',
    setData: (k: string, v: string) => void (store[k] = v),
    getData: (k: string) => store[k] ?? '',
  }
  const card = editButton(title).closest('.card') as HTMLElement
  fireEvent.dragStart(card, { dataTransfer })
  fireEvent.dragOver(region(toColumn), { dataTransfer })
  fireEvent.drop(region(toColumn), { dataTransfer })
}

beforeEach(() => {
  mocked.createCard.mockImplementation(async (fields, column) => ({ id: 'new-1', ...fields, column }))
  mocked.updateCard.mockResolvedValue(undefined)
  mocked.moveCardTo.mockResolvedValue(undefined)
  mocked.deleteCardById.mockResolvedValue(undefined)
})

describe('Board: loading', () => {
  it('places each card in its own column', async () => {
    renderBoard([
      makeCard({ title: 'A', column: 'backlog' }),
      makeCard({ title: 'B', column: 'done' }),
    ])
    expect(await within(region('Backlog')).findByRole('button', { name: 'Edit A' })).toBeInTheDocument()
    expect(within(region('Done')).getByRole('button', { name: 'Edit B' })).toBeInTheDocument()
    expect(within(region('In Progress')).queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument()
  })

  it('subscribes to realtime changes for this user and unsubscribes on unmount', async () => {
    const { unmount } = renderBoard()
    await screen.findByRole('heading', { name: 'My Board' })
    expect(supabaseMock.channel).toHaveBeenCalledWith('cards-user-1')
    expect(channelMock.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({ table: 'cards', filter: 'user_id=eq.user-1' }),
      expect.any(Function),
    )
    unmount()
    expect(supabaseMock.removeChannel).toHaveBeenCalled()
  })
})

describe('Board: creating cards', () => {
  it('creates a card from the column Add card button', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to Backlog' }))
    const dialog = screen.getByRole('dialog', { name: 'Add card' })
    await user.type(within(dialog).getByLabelText(/Name/), 'Write tests')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(mocked.createCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Write tests' }), 'backlog')
    expect(await within(region('Backlog')).findByRole('button', { name: 'Edit Write tests' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('preselects the column whose Add card button was used', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add card to In Review' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Column')).toHaveValue('in-review')
    await user.type(within(dialog).getByLabelText(/Name/), 'Needs review')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(mocked.createCard).toHaveBeenCalledWith(expect.anything(), 'in-review')
  })
})

describe('Board: editing cards', () => {
  it('opens a prefilled editor and saves changes', async () => {
    const user = userEvent.setup()
    renderBoard([makeCard({ id: 'a', title: 'Design review', assignee: 'Sam', column: 'in-progress' })])
    await user.click(await screen.findByRole('button', { name: 'Edit Design review' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit card' })
    expect(within(dialog).getByLabelText(/Name/)).toHaveValue('Design review')
    expect(within(dialog).getByLabelText('Assignee')).toHaveValue('Sam')

    await user.clear(within(dialog).getByLabelText(/Name/))
    await user.type(within(dialog).getByLabelText(/Name/), 'Design review v2')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(mocked.updateCard).toHaveBeenCalledWith('a', expect.objectContaining({ title: 'Design review v2' }))
    expect(mocked.moveCardTo).not.toHaveBeenCalled()
    expect(await within(region('In Progress')).findByRole('button', { name: 'Edit Design review v2' })).toBeInTheDocument()
  })
})

describe('Board: moving cards', () => {
  it('moves a card to another column using the Column field, without dragging', async () => {
    const user = userEvent.setup()
    renderBoard([makeCard({ id: 'a', title: 'Ship it', column: 'backlog' })])
    await user.click(await screen.findByRole('button', { name: 'Edit Ship it' }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Column'), 'done')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(mocked.moveCardTo).toHaveBeenCalledWith('a', 'done')
    expect(await within(region('Done')).findByRole('button', { name: 'Edit Ship it' })).toBeInTheDocument()
    expect(within(region('Backlog')).queryByRole('button', { name: 'Edit Ship it' })).not.toBeInTheDocument()
  })

  it('moves a card when it is dragged onto another column', async () => {
    renderBoard([makeCard({ id: 'a', title: 'Drag me', column: 'backlog' })])
    await screen.findByRole('button', { name: 'Edit Drag me' })
    dragCard('Drag me', 'In Progress')

    expect(mocked.moveCardTo).toHaveBeenCalledWith('a', 'in-progress')
    expect(within(region('In Progress')).getByRole('button', { name: 'Edit Drag me' })).toBeInTheDocument()
  })

  it('ignores a drop onto the column the card is already in', async () => {
    renderBoard([makeCard({ title: 'Stay put', column: 'backlog' })])
    await screen.findByRole('button', { name: 'Edit Stay put' })
    dragCard('Stay put', 'Backlog')
    expect(mocked.moveCardTo).not.toHaveBeenCalled()
  })

  it('shows an error and reloads from the server when a move fails', async () => {
    mocked.moveCardTo.mockRejectedValue(new Error('network down'))
    renderBoard([makeCard({ title: 'Oops', column: 'backlog' })])
    await screen.findByRole('button', { name: 'Edit Oops' })
    dragCard('Oops', 'Done')

    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    await waitFor(() => expect(mocked.fetchCards).toHaveBeenCalledTimes(2))
  })
})

describe('Board: deleting cards', () => {
  it('deletes immediately without a browser confirm, and can undo', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm')
    renderBoard([makeCard({ id: 'a', title: 'Doomed', column: 'in-progress' })])
    await user.click(await screen.findByRole('button', { name: 'Delete Doomed' }))

    expect(confirm).not.toHaveBeenCalled()
    expect(mocked.deleteCardById).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('button', { name: 'Edit Doomed' })).not.toBeInTheDocument()
    expect(screen.getByText('Deleted “Doomed”')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(mocked.createCard).toHaveBeenCalledWith(expect.objectContaining({ title: 'Doomed' }), 'in-progress')
    expect(await within(region('In Progress')).findByRole('button', { name: 'Edit Doomed' })).toBeInTheDocument()
  })

  it('deletes from inside the editor', async () => {
    const user = userEvent.setup()
    renderBoard([makeCard({ id: 'a', title: 'Gone soon' })])
    await user.click(await screen.findByRole('button', { name: 'Edit Gone soon' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete card' }))

    expect(mocked.deleteCardById).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Gone soon' })).not.toBeInTheDocument()
  })
})
