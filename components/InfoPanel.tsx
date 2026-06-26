'use client'

import { useEffect, useState } from 'react'

export default function InfoPanel() {
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (window.innerWidth < 640) setExpanded(false)
  }, [])

  return (
    <div className="fixed top-14 left-3 z-30 w-72 max-w-[calc(100vw-1.5rem)]">
      <div className="bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center justify-between w-full px-4 py-3 text-left"
        >
          <span className="text-white font-bold text-sm tracking-tight">Music Map</span>
          <span
            className="text-zinc-400 text-base leading-none transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          >
            ›
          </span>
        </button>

        {expanded && (
          <div className="px-4 pb-4">
            <p className="text-zinc-300 text-xs leading-relaxed">
              A global map of live music. Log events. Find shows. Explore the world through music.
            </p>
            <p className="text-zinc-500 text-xs mt-1">Powered by Sonic Boom Music CIC</p>

            <div className="border-t border-zinc-700 mt-3 pt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="text-base leading-none">🌍</span>
                <span>Drag to explore the globe</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="text-base leading-none">📍</span>
                <span>Click the map to log an event</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="text-base leading-none">🔴</span>
                <span>Click a pin to view details</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
