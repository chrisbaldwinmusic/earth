'use client'

const GENRES = [
  'Rock', 'Electronic', 'Folk', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World', 'Other',
]

const PRESETS = [
  { id: 'today',      label: 'Today' },
  { id: 'tomorrow',   label: 'Tomorrow' },
  { id: 'this-week',  label: 'This Week' },
  { id: 'next-week',  label: 'Next Week' },
  { id: 'this-month', label: 'This Month' },
] as const

type PresetId = typeof PRESETS[number]['id']

function fmt(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getPresetRange(preset: PresetId): [string, string] {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun … 6=Sat

  if (preset === 'today') {
    return [fmt(d), fmt(d)]
  }
  if (preset === 'tomorrow') {
    const t = new Date(d)
    t.setDate(t.getDate() + 1)
    return [fmt(t), fmt(t)]
  }
  if (preset === 'this-week') {
    const mon = new Date(d)
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return [fmt(mon), fmt(sun)]
  }
  if (preset === 'next-week') {
    const mon = new Date(d)
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + 7)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return [fmt(mon), fmt(sun)]
  }
  // this-month
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return [fmt(first), fmt(last)]
}

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
  const activePreset = PRESETS.find(({ id }) => {
    const [f, t] = getPresetRange(id)
    return f === dateFrom && t === dateTo
  })?.id ?? null

  const handlePreset = (id: PresetId) => {
    if (activePreset === id) {
      onDateFromChange('')
      onDateToChange('')
    } else {
      const [f, t] = getPresetRange(id)
      onDateFromChange(f)
      onDateToChange(t)
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-800">
      <div className="flex items-center gap-2 px-4 h-12 overflow-x-auto scrollbar-none">
        <select
          value={genreFilter}
          onChange={(e) => onGenreChange(e.target.value)}
          className="shrink-0 bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500 transition-colors"
        >
          <option value="">All Genres</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        {PRESETS.map(({ id, label }) => {
          const active = activePreset === id
          return (
            <button
              key={id}
              onClick={() => handlePreset(id)}
              className={
                'shrink-0 text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                (active
                  ? 'bg-red-700/80 border-red-600 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white')
              }
            >
              {label}
            </button>
          )
        })}

        <div className="w-px h-5 bg-zinc-700 shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-500 text-xs select-none">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500 transition-colors"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-zinc-500 text-xs select-none">To</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onDateToChange(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500 transition-colors"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="shrink-0 text-zinc-500 hover:text-white text-xs transition-colors ml-1"
          >
            Clear
          </button>
        )}

        <div className="flex-1" />

        {searchSlot}
      </div>
    </div>
  )
}
