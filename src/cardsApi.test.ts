import { describe, expect, it, vi } from 'vitest'
import { supabaseMock } from './test/supabaseMock'
import { createCard, deleteCardById, fetchCards, moveCardTo, updateCard } from './cardsApi'

type Result = { data?: unknown; error: Error | null }

// Chainable stand-in for the Supabase query builder. Awaiting it yields `result`.
function queryBuilder(result: Result) {
  const calls: Record<string, ReturnType<typeof vi.fn>> = {}
  const builder: Record<string, unknown> = {
    then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  }
  for (const m of ['select', 'order', 'insert', 'update', 'delete', 'eq', 'single']) {
    calls[m] = vi.fn(() => builder)
    builder[m] = calls[m]
  }
  supabaseMock.from.mockReturnValue(builder)
  return calls
}

const row = {
  id: 'r1',
  title: 'Write tests',
  description: 'desc',
  assignee: 'Sam',
  priority: 'High',
  due_date: '2026-11-05',
  column: 'in-review',
}

const fields = { title: 'T', description: 'D', assignee: 'A', priority: 'Low' as const, dueDate: '' }

describe('cardsApi', () => {
  it('maps database rows to cards, turning a null due date into an empty string', async () => {
    const calls = queryBuilder({ data: [row, { ...row, id: 'r2', due_date: null }], error: null })
    const cards = await fetchCards()
    expect(supabaseMock.from).toHaveBeenCalledWith('cards')
    expect(calls.order).toHaveBeenCalledWith('created_at')
    expect(cards[0]).toEqual({
      id: 'r1',
      title: 'Write tests',
      description: 'desc',
      assignee: 'Sam',
      priority: 'High',
      dueDate: '2026-11-05',
      column: 'in-review',
    })
    expect(cards[1].dueDate).toBe('')
  })

  it('creates a card in the given column and sends a null date when none is set', async () => {
    const calls = queryBuilder({ data: row, error: null })
    const card = await createCard(fields, 'done')
    expect(calls.insert).toHaveBeenCalledWith({
      title: 'T',
      description: 'D',
      assignee: 'A',
      priority: 'Low',
      due_date: null,
      column: 'done',
    })
    expect(card.id).toBe('r1')
  })

  it('updates only the content fields of the matching card', async () => {
    const calls = queryBuilder({ error: null })
    await updateCard('abc', fields)
    expect(calls.update).toHaveBeenCalledWith({
      title: 'T',
      description: 'D',
      assignee: 'A',
      priority: 'Low',
      due_date: null,
    })
    expect(calls.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it('moves a card by changing only its column', async () => {
    const calls = queryBuilder({ error: null })
    await moveCardTo('abc', 'in-progress')
    expect(calls.update).toHaveBeenCalledWith({ column: 'in-progress' })
    expect(calls.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it('deletes the matching card', async () => {
    const calls = queryBuilder({ error: null })
    await deleteCardById('abc')
    expect(calls.delete).toHaveBeenCalled()
    expect(calls.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it.each([
    ['fetchCards', () => fetchCards()],
    ['createCard', () => createCard(fields, 'backlog')],
    ['updateCard', () => updateCard('a', fields)],
    ['moveCardTo', () => moveCardTo('a', 'done')],
    ['deleteCardById', () => deleteCardById('a')],
  ])('%s surfaces database errors instead of swallowing them', async (_name, call) => {
    queryBuilder({ data: null, error: new Error('permission denied') })
    await expect(call()).rejects.toThrow('permission denied')
  })
})
