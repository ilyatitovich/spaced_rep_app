import { X, Search as SearchIcon } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'

type SearchProps = {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  debounceMs?: number
}

export default function Search({
  value = '',
  onChange,
  placeholder = 'Search…'
}: SearchProps) {
  const [internalValue, setInternalValue] = useState(value)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value
    setInternalValue(nextValue)
    onChange(nextValue)
  }

  const handleClear = () => {
    setInternalValue('')
    onChange('')
  }

  return (
    <div className="relative w-full px-4 py-2">
      <div className="absolute h-full flex items-center justify-center left-8 top-1/2 -translate-y-1/2 text-gray-500">
        <SearchIcon />
      </div>
      <input
        type="search"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full py-3 pr-12 pl-13 rounded-xl border border-gray-300 focus:border-purple-600 focus:outline-none transition [&::-webkit-search-cancel-button]:hidden"
      />

      {internalValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="
              absolute right-8 top-1/2 -translate-y-1/2
              rounded-md p-1
            "
        >
          <X className="text-gray-600" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
