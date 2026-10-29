import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeCard } from '../test/fixtures'
import type { CardData } from '../types'
import CardModal from './CardModal'

function setup(card: CardData | null = null, onSave = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn()
  const onDelete = vi.fn()
  render(<CardModal card={card} column="backlog" onSave={onSave} onClose={onClose} onDelete={card ? onDelete : undefined} />)
  return { onSave, onClose, onDelete, user: userEvent.setup() }
}

const nameInput = () => screen.getByLabelText(/Name/)
const backdrop = () => screen.getByRole('dialog').parentElement as HTMLElement

describe('CardModal: quick capture (UX audit)', () => {
  it('only needs a name: assignee and due date are optional', async () => {
    const { user, onSave } = setup()
    await user.type(nameInput(), 'Ship it')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Ship it', assignee: '', dueDate: '' }))
  })

  it('trims whitespace around the text fields', async () => {
    const { user, onSave } = setup()
    await user.type(nameInput(), '  Padded  ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Padded' }))
  })

  it('rejects a whitespace-only name with a visible error, and puts focus back on the field', async () => {
    const { user, onSave } = setup()
    await user.type(nameInput(), '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a card name.')
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(nameInput()).toHaveAccessibleDescription('Please enter a card name.')
    expect(nameInput()).toHaveFocus()
  })

  it('keeps the dialog open and the edits intact when saving fails', async () => {
    const { user, onClose } = setup(null, vi.fn().mockRejectedValue(new Error('permission denied')))
    await user.type(nameInput(), 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('permission denied')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('Keep me')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows a pending state while saving', async () => {
    const { user } = setup(null, vi.fn(() => new Promise<void>(() => {})))
    await user.type(nameInput(), 'Slow')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  })

  it('lets a card be moved to any column from the form', () => {
    setup()
    const options = screen.getByLabelText('Column').querySelectorAll('option')
    expect([...options].map((o) => o.textContent)).toEqual(['Backlog', 'In Progress', 'In Review', 'Done'])
  })
})

describe('CardModal: accessibility (WCAG audit)', () => {
  it('is a modal dialog named for what it does', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'Add card' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('is named "Edit card" for an existing card', () => {
    setup(makeCard())
    expect(screen.getByRole('dialog', { name: 'Edit card' })).toBeInTheDocument()
  })

  it('marks the name as required for assistive technology', () => {
    setup()
    expect(nameInput()).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('(required)')).toBeInTheDocument()
  })

  it('focuses the name field on open', () => {
    setup()
    expect(nameInput()).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const { user, onClose } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps Tab inside the dialog in both directions', async () => {
    const { user } = setup()
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(save).toHaveFocus()
  })

  it('closes on a complete click of the backdrop (pointer cancellation, 2.5.2)', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(backdrop())
    expect(onClose).not.toHaveBeenCalled() // pressing alone must not close it
    fireEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when a press starts inside the dialog and is released on the backdrop', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(nameInput())
    fireEvent.click(backdrop())
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('CardModal: input limits (security audit)', () => {
  it('caps the text fields to match the database constraints', () => {
    setup()
    expect(nameInput()).toHaveAttribute('maxlength', '200')
    expect(screen.getByLabelText('Description')).toHaveAttribute('maxlength', '5000')
    expect(screen.getByLabelText('Assignee')).toHaveAttribute('maxlength', '100')
  })
})
