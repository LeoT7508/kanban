import type { CardData } from '../types'

let n = 0

export function makeCard(overrides: Partial<CardData> = {}): CardData {
  n += 1
  return {
    id: `card-${n}`,
    title: `Card ${n}`,
    description: '',
    assignee: '',
    priority: 'Medium',
    dueDate: '',
    column: 'backlog',
    ...overrides,
  }
}
