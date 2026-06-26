'use client'

import { useEffect, useRef, useState } from 'react'

interface Result {
  id: string
  place_name: string
  center: [number, number]
}

interface Props {
  token: string
  onFlyTo: (center: [number, number]) => void
}

export default function Search({ token, onFlyTo }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
          `?access_token=${token}&autocomplete=true&limit=6&types=place,postcode,address,region,country,locality`
        )
        const data = await res.json()
        setResults(data.features ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query, token])

  // close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleSelect = (r: Result) => {
    onFlyTo(r.center)
    setQuery(r.place_name)
    setOpen(false)
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative ml-auto">
      <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 gap-1.5 focus-within:border-zinc-500 transition-colors">
        {/* search icon */}
        <svg className="text-zinc-500 shrink-0" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search places, postcodes…"
          className="bg-transparent text-white text-sm focus:outline-none w-52 placeholder:text-zinc-600"
        />
        {query && (
          <button onClick={handleClear} className="text-zinc-500 hover:text-white transition-colors">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        )}
        {loading && (
          <svg className="animate-spin text-zinc-500 shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute right-0 mt-1 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
          {results.map((r) => (
            <li key={r.id}>
              <button
                className="w-full text-left px-3 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors flex items-start gap-2"
                onClick={() => handleSelect(r)}
              >
                <svg className="text-zinc-500 mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span>{r.place_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
