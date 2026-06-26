'use client'

const GENRES = [
  'Rock', 'Electronic', 'Folk', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World', 'Other',
]

const controlClass =
  'bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-2 py-1.5 ' +
  'focus:outline-none focus:border-zinc-500 transition-colors'

interface Props {
  genreFilter: string
  dateFrom: string
  dateTo: string
  hasActiveFilters: boolean
  onGenreChange: (v: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onClear: () => void
  searchSlot?: React.ReactNode
}

export default function FilterBar({
  genreFilter,
  dateFrom,
  dateTo,
  hasActiveFilters,
  onGenreChange,
  onDateFromChange,
  onDateToChange,
  onClear,
  searchSlot,
}: Props) {
  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
      <div className="flex items-center gap-3 px-4 h-12">
        <select
          value={genreFilter}
          onChange={(e) => onGenreChange(e.target.value)}
          className={controlClass}
        >
          <option value="">All Genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-xs select-none">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={controlClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-xs select-none">To</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onDateToChange(e.target.value)}
            className={controlClass}
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-zinc-400 hover:text-white text-sm transition-colors ml-1"
          >
            Clear filters
          </button>
        )}

        {searchSlot}
      </div>
    </div>
  )
}
