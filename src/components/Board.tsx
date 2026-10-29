import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { COLUMNS } from '../types'
import type { CardData, ColumnId } from '../types'
import { supabase } from '../supabase'
import { createCard, deleteCardById, fetchCards, moveCardTo, updateCard } from '../cardsApi'
import Column from './Column'
import logoIcon from '../assets/logo-sm.svg'
import CardModal from './CardModal'
import type { CardFormValues } from './CardModal'

type ModalState = { card: CardData | null; column: ColumnId } | null

const UNDO_MS = 10000
const labelOf = (id: ColumnId) => COLUMNS.find((c) => c.id === id)?.label ?? id

interface Props {
  userId: string
  email: string
}

export default function Board({ userId, email }: Props) {
  const [cards, setCards] = useState<CardData[]>([])
  const [modal, setModal] = useState<ModalState>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [undo, setUndo] = useState<CardData | null>(null)
  const [announce, setAnnounce] = useState('')
  const undoTimer = useRef(0)
  const opener = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const stopUndoTimer = () => window.clearTimeout(undoTimer.current)
  const startUndoTimer = () => {
    stopUndoTimer()
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS)
  }

  const openModal = (state: NonNullable<ModalState>, from: HTMLElement) => {
    opener.current = from
    setModal(state)
  }

  // Put focus back where the user was, or on the page heading if that element is gone.
  const closeModal = useCallback(() => {
    setModal(null)
    requestAnimationFrame(() => {
      const target = opener.current?.isConnected ? opener.current : headingRef.current
      target?.focus()
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      setCards(await fetchCards())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const channel = supabase
      .channel(`cards-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cards', filter: `user_id=eq.${userId}` }, () => void refresh())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  // Optimistic update, then reconcile with the server if the write fails.
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      void refresh()
    }
  }

  const moveCard = (id: string, column: ColumnId) => {
    const card = cards.find((c) => c.id === id)
    if (!card || card.column === column) return
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, column } : c)))
    setAnnounce(`Moved ${card.title} to ${labelOf(column)}`)
    void run(() => moveCardTo(id, column))
  }

  // Delete right away, then offer a short window to restore the card.
  const deleteCard = (id: string) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    setCards((cs) => cs.filter((c) => c.id !== id))
    void run(() => deleteCardById(id))
    setUndo(card)
    startUndoTimer()
  }

  const undoDelete = () => {
    if (!undo) return
    stopUndoTimer()
    const card = undo
    setUndo(null)
    setAnnounce(`Restored ${card.title}`)
    void run(async () => {
      const restored = await createCard(card, card.column)
      setCards((cs) => (cs.some((c) => c.id === restored.id) ? cs : [...cs, restored]))
    })
  }

  const save = async (values: CardFormValues) => {
    const editing = modal?.card
    if (editing) {
      await updateCard(editing.id, values)
      if (values.column !== editing.column) await moveCardTo(editing.id, values.column)
      setCards((cs) => cs.map((c) => (c.id === editing.id ? { ...c, ...values } : c)))
      setAnnounce(`Saved ${values.title}`)
    } else {
      const created = await createCard(values, values.column)
      setCards((cs) => (cs.some((c) => c.id === created.id) ? cs : [...cs, created]))
      setAnnounce(`Added ${values.title} to ${labelOf(values.column)}`)
    }
    setError('')
    closeModal()
  }

  return (
    <div className="board-wrap">
      <div inert={modal !== null}>
        <a className="skip-link" href="#main">
          Skip to board
        </a>
        <header className="navbar">
          <div className="brand">
            <span className="logo">
              <span className="logo-icon" aria-hidden="true" style={{ '--icon': `url(${logoIcon})` } as CSSProperties} />
            </span>
            FlowBoard
          </div>
          <div className="nav-user">
            <span className="avatar" aria-hidden="true">
              {(email[0] ?? 'U').toUpperCase()}
            </span>
            <span className="visually-hidden">Signed in as {email}</span>
            <button type="button" className="text-btn" onClick={() => void supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="subbar">
            <h1 ref={headingRef} tabIndex={-1}>
              My Board
            </h1>
            <span className="hint">
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </span>
          </div>
          {error && (
            <p role="alert" className="error">
              <span>{error}</span>
              <button type="button" className="text-btn" onClick={() => setError('')}>
                Dismiss
              </button>
            </p>
          )}
          <div className="board">
            {COLUMNS.map((col) => (
              <Column
                key={col.id}
                id={col.id}
                label={col.label}
                loading={loading}
                cards={cards.filter((c) => c.column === col.id)}
                onDropCard={moveCard}
                onAdd={(column, from) => openModal({ card: null, column }, from)}
                onEdit={(card, from) => openModal({ card, column: card.column }, from)}
                onDelete={deleteCard}
              />
            ))}
          </div>
        </main>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {loading ? 'Loading cards…' : announce}
      </p>
      {undo && (
        <div
          className="toast"
          role="status"
          onMouseEnter={stopUndoTimer}
          onMouseLeave={startUndoTimer}
          onFocus={stopUndoTimer}
          onBlur={startUndoTimer}
        >
          <span>Deleted “{undo.title}”</span>
          <button type="button" className="text-btn" onClick={undoDelete}>
            Undo
          </button>
          <button
            type="button"
            className="text-btn"
            aria-label="Dismiss"
            onClick={() => {
              stopUndoTimer()
              setUndo(null)
            }}
          >
            ✕
          </button>
        </div>
      )}
      {modal && (
        <CardModal
          key={modal.card?.id ?? 'new'}
          card={modal.card}
          column={modal.column}
          onSave={save}
          onDelete={
            modal.card
              ? () => {
                  deleteCard(modal.card!.id)
                  closeModal()
                }
              : undefined
          }
          onClose={closeModal}
        />
      )}
    </div>
  )
}
