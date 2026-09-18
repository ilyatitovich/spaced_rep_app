import { X, ListCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'

import Button from './button'

type SelectionModeHeaderProps = {
  selectedItemsCount: number
  isAllSelected: boolean
  handleCancel: () => void
  handleSelectAll: (isSelect: boolean) => void
  isHidden?: boolean
}

export default function SelectionModeHeader({
  selectedItemsCount,
  isAllSelected = false,
  handleCancel,
  handleSelectAll,
  isHidden = false
}: SelectionModeHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (headerRef.current) headerRef.current.inert = isHidden
  }, [isHidden])

  return (
    <div
      ref={headerRef}
      className={`absolute top-0 left-0 right-0 z-50 w-full flex justify-between items-center p-4 bg-background transition-[opacity,translate] duration-300 ease-in-out ${
        isHidden
          ? 'pointer-events-none -translate-y-full opacity-0'
          : 'translate-y-0 opacity-100 starting:-translate-y-full starting:opacity-0'
      }`}
    >
      <Button aria-label="Cancel selection" onClick={handleCancel}>
        <X />
      </Button>
      <span>
        {selectedItemsCount === 0
          ? 'Select items'
          : `${selectedItemsCount} selected ${selectedItemsCount === 1 ? 'item' : 'items'}`}
      </span>
      <Button
        aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
        onClick={() => handleSelectAll(!isAllSelected)}
      >
        <ListCheck
          className={`${isAllSelected ? 'text-primary' : 'text-foreground'}`}
        />
      </Button>
    </div>
  )
}
