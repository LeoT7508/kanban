import type { CardData } from '../types'
import trashIcon from '../assets/trash.svg'

interface Props {
  card: CardData
  onEdit: (card: CardData, opener: HTMLElement) => void
  onDelete: (id: string) => void
}

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function Card({ card, onEdit, onDelete }: Props) {
  return (
    <div
      className="card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(e) => {
        const opener = e.currentTarget.querySelector<HTMLElement>('.card-title')
        if (opener) onEdit(card, opener)
      }}
    >
      <div className="card-top">
        <h3>
          <button type="button" className="card-title" aria-label={`Edit ${card.title}`}>
            {card.title}
          </button>
        </h3>
        <button
          type="button"
          className="trash-btn"
          aria-label={`Delete ${card.title}`}
          title="Delete card"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(card.id)
          }}
        >
          <img src={trashIcon} alt="" width={20} height={20} />
        </button>
      </div>
      {card.description && <p className="card-desc">{card.description}</p>}
      <div className="meta">
        <span className={`badge ${card.priority.toLowerCase()}`}>{card.priority}</span>
        {card.assignee && <span>{card.assignee}</span>}
        {card.dueDate && <time dateTime={card.dueDate}>Due {formatDate(card.dueDate)}</time>}
      </div>
    </div>
  )
}
