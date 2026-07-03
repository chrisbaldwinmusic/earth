'use client'

import { useEffect, useState } from 'react'

const PIN_KEY = 'sb-music-map-site-unlocked'
const SITE_PIN = '2023'

export default function SitePinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUnlocked(localStorage.getItem(PIN_KEY) === 'true')
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === SITE_PIN) {
      localStorage.setItem(PIN_KEY, 'true')
      setUnlocked(true)
      setError(null)
    } else {
      setError('Incorrect PIN')
    }
  }

  // Avoid a flash of the gate before the localStorage check resolves.
  if (unlocked === null) return null

  if (!unlocked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        >
          <h1 className="text-white text-lg font-semibold mb-4 text-center">Enter PIN</h1>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="PIN"
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-3 py-2 mb-3 focus:outline-none focus:border-zinc-500 text-center tracking-widest"
          />
          {error && <p className="text-red-400 text-sm mb-3 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-red-700/80 hover:bg-red-700 text-white text-sm rounded-md py-2 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
