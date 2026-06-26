'use client'

import { useEffect, useRef, useState } from 'react'
import type { LineupEntry, MapEvent } from '@/types/events'

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
  initialEvent?: MapEvent
  prefillVenue?: { venue: string; city: string; country: string }
}

const inputClass =
  'w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 transition-colors'

const labelClass = 'block text-zinc-500 text-xs uppercase tracking-wider mb-1'

export default function AddEventModal({ lat, lng, token, onSubmit, onClose, initialEvent, prefillVenue }: Props) {
  const isEditing = Boolean(initialEvent)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(initialEvent?.name ?? '')
  const [venue, setVenue] = useState(initialEvent?.venue ?? prefillVenue?.venue ?? '')
  const [genre, setGenre] = useState(initialEvent?.genre ?? 'Rock')
  const [date, setDate] = useState(initialEvent?.date ?? '')
  const [city, setCity] = useState(initialEvent?.city ?? prefillVenue?.city ?? '')
  const [country, setCountry] = useState(initialEvent?.country ?? prefillVenue?.country ?? '')
  const [ticketLink, setTicketLink] = useState(initialEvent?.ticketLink ?? '')
  const [websiteLink, setWebsiteLink] = useState(initialEvent?.websiteLink ?? '')
  const [lineup, setLineup] = useState<LineupEntry[]>(initialEvent?.lineup ?? [])
  const [geocoding, setGeocoding] = useState(!isEditing && !prefillVenue)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (isEditing || prefillVenue) return
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
      id: initialEvent?.id ?? crypto.randomUUID(),
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
      lineup: lineup.filter((e) => e.name.trim()).length > 0
        ? lineup.filter((e) => e.name.trim())
        : undefined,
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
          <h2 className="text-white font-semibold text-lg">{isEditing ? 'Edit Event' : 'Log Event'}</h2>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass + ' mb-0'}>
                Lineup <span className="normal-case tracking-normal text-zinc-600">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setLineup((prev) => [...prev, { name: '', time: '' }])}
                className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
                Add performer
              </button>
            </div>
            {lineup.length === 0 ? (
              <p className="text-zinc-600 text-xs py-1">No lineup added yet.</p>
            ) : (
              <div className="space-y-2">
                {lineup.map((entry, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(e) => setLineup((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                      placeholder="DJ / Artist name"
                      className={inputClass + ' flex-1'}
                    />
                    <input
                      type="time"
                      value={entry.time ?? ''}
                      onChange={(e) => setLineup((prev) => prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}
                      className={inputClass + ' w-28'}
                      style={{ colorScheme: 'dark' }}
                    />
                    <button
                      type="button"
                      onClick={() => setLineup((prev) => prev.filter((_, j) => j !== i))}
                      className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                      aria-label="Remove"
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {isEditing ? 'Update Event' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
