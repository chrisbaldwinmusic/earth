'use client'

import { useEffect, useRef, useState } from 'react'
import type { MapEvent } from '@/types/events'

const GENRES = [
  'Rock', 'Electronic', 'Folk', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World', 'Other',
]

interface Props {
  lat: number
  lng: number
  token: string
  onSubmit: (event: MapEvent) => void
  onClose: () => void
}

const inputClass =
  'w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 transition-colors'

const labelClass = 'block text-zinc-500 text-xs uppercase tracking-wider mb-1'

export default function AddEventModal({ lat, lng, token, onSubmit, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [venue, setVenue] = useState('')
  const [genre, setGenre] = useState('Rock')
  const [date, setDate] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [ticketLink, setTicketLink] = useState('')
  const [websiteLink, setWebsiteLink] = useState('')
  const [geocoding, setGeocoding] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function reverseGeocode() {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,country`,
        )
        const data = await res.json()
        const place = data.features?.find((f: { place_type: string[] }) =>
          f.place_type.includes('place'),
        )
        const countryFeature = data.features?.find((f: { place_type: string[] }) =>
          f.place_type.includes('country'),
        )
        setCity((place as { text?: string } | undefined)?.text ?? '')
        setCountry((countryFeature as { text?: string } | undefined)?.text ?? '')
      } catch {
        // leave fields blank for user to fill in
      } finally {
        setGeocoding(false)
      }
    }
    reverseGeocode()
  }, [lat, lng, token])

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      id: crypto.randomUUID(),
      name,
      venue,
      genre,
      date,
      city,
      country,
      lat,
      lng,
      source: 'user',
      ticketLink: ticketLink.trim() || undefined,
      websiteLink: websiteLink.trim() || undefined,
    })
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Log Event</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Event Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Boiler Room"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Venue</label>
            <input
              type="text"
              required
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue name"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className={inputClass}
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                required
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                City
                {geocoding && (
                  <span className="ml-1 text-zinc-600 normal-case tracking-normal">
                    · locating…
                  </span>
                )}
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Ticket Link <span className="normal-case tracking-normal text-zinc-600">(optional)</span></label>
            <input
              type="url"
              value={ticketLink}
              onChange={(e) => setTicketLink(e.target.value)}
              placeholder="https://ra.co/events/…"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Website / Social <span className="normal-case tracking-normal text-zinc-600">(optional)</span></label>
            <input
              type="url"
              value={websiteLink}
              onChange={(e) => setWebsiteLink(e.target.value)}
              placeholder="https://instagram.com/…"
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 text-sm text-white font-medium rounded-lg transition-colors"
              style={{ backgroundColor: '#C8102E' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#a50d25')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C8102E')}
            >
              Save Event
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
