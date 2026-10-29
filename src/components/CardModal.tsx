import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { COLUMNS, PRIORITIES } from '../types'
import type { CardData, ColumnId, Priority } from '../types'
import closeA from '../assets/close-a.svg'
import closeB from '../assets/close-b.svg'

export interface CardFormValues {
  title: string
  description: string
  assignee: string
  priority: Priority
  dueDate: string
  column: ColumnId
}

interface Props {
  card: CardData | null
  column: ColumnId
  onSave: (values: CardFormValues) => Promise<void>
  onDelete?: () => void
  onClose: () => void
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]'

export default function CardModal({ card, column, onSave, onDelete, onClose }: Props) {
  const [values, setValues] = useState<CardFormValues>({
    title: card?.title ?? '',
    description: card?.description ?? '',
    assignee: card?.assignee ?? '',
    priority: card?.priority ?? 'Medium',
    dueDate: card?.dueDate ?? '',
    column,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [titleInvalid, setTitleInvalid] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep Tab / Shift+Tab inside the dialog.
  const trapFocus = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!values.title.trim()) {
      setError('Please enter a card name.')
      setTitleInvalid(true)
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    setError('')
    setTitleInvalid(false)
    try {
      await onSave({
        ...values,
        title: values.title.trim(),
        description: values.description.trim(),
        assignee: values.assignee.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the card.')
      setSaving(false)
    }
  }

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="card-modal-title" onKeyDown={trapFocus}>
        <form className="modal card-modal" onSubmit={(e) => void submit(e)} noValidate>
          <div className="modal-head">
            <h2 id="card-modal-title">{card ? 'Edit card' : 'Add card'}</h2>
            <button type="button" className="close-btn" aria-label="Close" onClick={onClose}>
              <span className="close-icon" aria-hidden="true">
                <img src={closeA} alt="" />
                <img src={closeB} alt="" />
              </span>
            </button>
          </div>
          <label className="field">
            <span className="label">
              Name <span className="required">(required)</span>
            </span>
            <input
              ref={titleRef}
              autoFocus
              aria-required="true"
              aria-invalid={titleInvalid}
              aria-describedby={error ? 'card-modal-error' : undefined}
              maxLength={200}
              placeholder="Enter card name..."
              value={values.title}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="label small">Description</span>
            <textarea
              rows={3}
              maxLength={5000}
              placeholder="Add a description..."
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="label small">Assignee</span>
            <input
              maxLength={100}
              placeholder="Who is working on this?"
              value={values.assignee}
              onChange={(e) => setValues({ ...values, assignee: e.target.value })}
            />
          </label>
          <div className="row">
            <label className="field">
              <span className="label small">Column</span>
              <select value={values.column} onChange={(e) => setValues({ ...values, column: e.target.value as ColumnId })}>
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label small">Priority</span>
              <select
                value={values.priority}
                onChange={(e) => setValues({ ...values, priority: e.target.value as Priority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="label small">Due Date</span>
            <input
              type="date"
              value={values.dueDate}
              onChange={(e) => setValues({ ...values, dueDate: e.target.value })}
            />
          </label>
          {error && (
            <p id="card-modal-error" role="alert" className="error modal-error">
              {error}
            </p>
          )}
          <div className="actions">
            {onDelete && (
              <button type="button" className="link-danger" onClick={onDelete}>
                Delete card
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
