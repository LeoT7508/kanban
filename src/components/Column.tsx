import { useState } from 'react'
import type { CardData, ColumnId } from '../types'
import Card from './Card'
import plusIcon from '../assets/plus.svg'
import uploadIcon from '../assets/upload.svg'

interface Props {
  id: ColumnId
  label: string
  cards: CardData[]
  loading: boolean
  onDropCard: (cardId: string, column: ColumnId) => void
  onAdd: (column: ColumnId, opener: HTMLElement) => void
  onEdit: (card: CardData, opener: HTMLElement) => void
  onDelete: (id: string) => void
}

export default function Column({ id, label, cards, loading, onDropCard, onAdd, onEdit, onDelete }: Props) {
  const [over, setOver] = useState(false)
  return (
    <section
      aria-labelledby={`col-${id}`}
      className={`column${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        if (cardId) onDropCard(cardId, id)
      }}
    >
      <div className="column-head">
        <h2 id={`col-${id}`}>{label}</h2>
        <div className="column-actions">
          <button type="button" className="add-btn" aria-label={`Add card to ${label}`} onClick={(e) => onAdd(id, e.currentTarget)}>
            <img src={plusIcon} alt="" width={16} height={16} />
            Add card
          </button>
          <span className="vrule" aria-hidden="true" />
          <span className="count">
            {cards.length}
            <span className="visually-hidden"> {cards.length === 1 ? 'card' : 'cards'}</span>
          </span>
        </div>
      </div>
      <div className="cards">
        {loading ? (
          <div className="skeleton" aria-hidden="true" />
        ) : cards.length === 0 ? (
          <div className="empty">
            <img src={uploadIcon} alt="" width={24} height={24} />
            <p>Drop a card here or add one</p>
          </div>
        ) : (
          <ul className="card-list">
            {cards.map((c) => (
              <li key={c.id}>
                <Card card={c} onEdit={onEdit} onDelete={onDelete} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
