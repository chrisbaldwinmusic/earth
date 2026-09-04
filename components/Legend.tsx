'use client'

import { useState } from 'react'

const ENTRIES = [
  {
    label: 'Sonic Boom · Daytime',
    swatch: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path
          d="M12 1.5l2.85 6.6 7.15.63-5.4 4.72 1.62 7.05L12 16.9l-6.22 3.6 1.62-7.05L2 8.73l7.15-.63L12 1.5z"
          fill="#FFC53D"
          stroke="#8a5a00"
          strokeWidth="1"
        />
      </svg>
    ),
  },
  {
    label: 'Sonic Boom · Aftershock',
    swatch: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <path d="M12 2l9 10-9 10-9-10z" fill="#A855F7" stroke="#4c1d78" strokeWidth="1" />
      </svg>
    ),
  },
  {
    label: 'Independent Event',
    swatch: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
        <circle cx="12" cy="12" r="8" fill="#2DD4BF" stroke="#0f766e" strokeWidth="2" />
      </svg>
    ),
  },
]

export default function Legend() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="fixed bottom-4 left-3 z-30 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl">
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-left"
        >
          <span className="text-white font-bold text-xs tracking-tight">Pin Key</span>
          <span
            className="text-zinc-400 text-base leading-none transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          >
            ›
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-3 space-y-1.5">
            {ENTRIES.map((entry) => (
              <div key={entry.label} className="flex items-center gap-2.5 text-xs text-zinc-300">
                {entry.swatch}
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
