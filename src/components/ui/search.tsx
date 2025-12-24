import { X, Search as SearchIcon } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'

type SearchProps = {
  value?: string
  onSearch: (value: string) => void
  placeholder?: string
}

export default function Search({
  value = '',
  onSearch,
  placeholder = 'Search…'
}: SearchProps) {
  const [internalValue, setInternalValue] = useState(value)

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value
    setInternalValue(nextValue)
    onSearch(nextValue)
  }

  const handleClear = () => {
    setInternalValue('')
    onSearch('')
  }

  return (
    <div className="relative w-full px-4">
      <div className="absolute h-full flex items-center justify-center left-7 top-1/2 -translate-y-1/2 text-gray-500">
        <SearchIcon size={18} />
      </div>
      <input
        type="search"
        value={internalValue}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full py-3 px-10 rounded-lg border border-gray-300 focus:border-purple-600 focus:outline-none transition [&::-webkit-search-cancel-button]:hidden text-sm"
      />

      {internalValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="
              absolute right-7 top-1/2 -translate-y-1/2
            "
        >
          <X size={18} className="text-gray-600" />
        </button>
      )}
    </div>
  )
}
