import { SquarePen } from 'lucide-react'

type CardsScreenProps = {
  count: number
  onShowEditor: () => void
}

export default function CardsScreen({ count, onShowEditor }: CardsScreenProps) {
  return (
    <section className="flex-1 min-h-0 flex flex-col">
      <header className="h-14 px-3 border-b border-border flex items-center justify-between gap-2">
        <button title="Editor" onClick={onShowEditor}>
          <SquarePen size={17} />
        </button>
        <span className="text-sm font-medium">Cards</span>
        <span className="text-sm">{count}</span>
      </header>
      <div className="flex-1 min-h-0" />
    </section>
  )
}
