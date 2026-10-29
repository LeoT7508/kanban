import { supabase } from './supabase'
import type { CardData, ColumnId, Priority } from './types'

interface CardRow {
  id: string
  title: string
  description: string
  assignee: string
  priority: Priority
  due_date: string | null
  column: ColumnId
}

const toCard = (r: CardRow): CardData => ({
  id: r.id,
  title: r.title,
  description: r.description,
  assignee: r.assignee,
  priority: r.priority,
  dueDate: r.due_date ?? '',
  column: r.column,
})

export type CardFields = Pick<CardData, 'title' | 'description' | 'assignee' | 'priority' | 'dueDate'>

const toRow = (f: CardFields) => ({
  title: f.title,
  description: f.description,
  assignee: f.assignee,
  priority: f.priority,
  due_date: f.dueDate || null,
})

export async function fetchCards(): Promise<CardData[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, title, description, assignee, priority, due_date, column')
    .order('created_at')
  if (error) throw error
  return (data as CardRow[]).map(toCard)
}

export async function createCard(f: CardFields, column: ColumnId): Promise<CardData> {
  const { data, error } = await supabase
    .from('cards')
    .insert({ ...toRow(f), column })
    .select('id, title, description, assignee, priority, due_date, column')
    .single()
  if (error) throw error
  return toCard(data as CardRow)
}

export async function updateCard(id: string, f: CardFields): Promise<void> {
  const { error } = await supabase.from('cards').update(toRow(f)).eq('id', id)
  if (error) throw error
}

export async function moveCardTo(id: string, column: ColumnId): Promise<void> {
  const { error } = await supabase.from('cards').update({ column }).eq('id', id)
  if (error) throw error
}

export async function deleteCardById(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}
