'use client'

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import type { LineupEntry, MapEvent } from '@/types/events'
import { GENRES } from '@/lib/genres'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
      ) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}

interface Props {
  lat: number
  lng: number
  token: string
  turnstileSiteKey: string
  onSaved: (event: MapEvent, editToken?: string) => void
  onClose: () => void
  initialEvent?: MapEvent
  prefillVenue?: { venue: string; city: string; country: string }
  editToken?: string
  // When set, edits are saved as an admin (any event, not just this browser's
  // own 'user' submissions) via the admin API instead of the owner edit-token one.
  adminPassword?: string
}

const inputClass =
  'w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 transition-colors'

const inlineInputClass =
  'bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:border-zinc-500 placeholder:text-zinc-600 transition-colors'

const labelClass = 'block text-zinc-500 text-xs uppercase tracking-wider mb-1'

export default function AddEventModal({
  lat, lng, token, turnstileSiteKey, onSaved, onClose, initialEvent, prefillVenue, editToken,
  adminPassword,
}: Props) {
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
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | undefined>(undefined)

  const today = new Date().toISOString().split('T')[0]

  // Render the Turnstile widget explicitly once its script is loaded (create mode only —
  // edits are authorized via the ownership edit token instead of a fresh CAPTCHA solve).
  useEffect(() => {
    if (isEditing || !turnstileReady || !turnstileContainerRef.current || !window.turnstile) return
    const widgetId = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (t) => setTurnstileToken(t),
      'expired-callback': () => setTurnstileToken(null),
    })
    turnstileWidgetId.current = widgetId
    return () => {
      window.turnstile?.remove(widgetId)
      turnstileWidgetId.current = undefined
    }
  }, [isEditing, turnstileReady, turnstileSiteKey])

  useEffect(() => {
    if (isEditing || prefillVenue) return
    async function reverseGeocode() {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,country`,
        )
        const data = (await res.json()) as {
          features?: { place_type: string[]; text?: string }[]
        }
        const place = data.features?.find((f) => f.place_type.includes('place'))
        const countryFeature = data.features?.find((f) => f.place_type.includes('country'))
        setCity(place?.text ?? '')
        setCountry(countryFeature?.text ?? '')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isEditing && !turnstileToken) return

    const payload = {
      name,
      venue,
      genre,
      date,
      city,
      country,
      lat,
      lng,
      ticketLink: ticketLink.trim() || undefined,
      websiteLink: websiteLink.trim() || undefined,
      lineup: lineup.filter((entry) => entry.name.trim()).length > 0
        ? lineup.filter((entry) => entry.name.trim())
        : undefined,
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      if (isEditing) {
        const res = adminPassword
          ? await fetch(`/api/admin/events/${initialEvent!.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'X-Admin-Password': adminPassword },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/events/${initialEvent!.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', 'X-Edit-Token': editToken ?? '' },
              body: JSON.stringify(payload),
            })
        if (!res.ok) throw new Error('Failed to update event')
        onSaved((await res.json()) as MapEvent)
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, 'cf-turnstile-response': turnstileToken }),
        })
        if (!res.ok) {
          if (turnstileWidgetId.current) window.turnstile?.reset(turnstileWidgetId.current)
          setTurnstileToken(null)
          throw new Error('Failed to save event')
        }
        const { event, editToken: newEditToken } = (await res.json()) as { event: MapEvent; editToken: string }
        onSaved(event, newEditToken)
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                      className={inlineInputClass + ' flex-1 min-w-0'}
                    />
                    <input
                      type="time"
                      value={entry.time ?? ''}
                      onChange={(e) => setLineup((prev) => prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x))}
                      className={inlineInputClass + ' w-28 shrink-0'}
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

          {!isEditing && (
            <div>
              <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
                onReady={() => setTurnstileReady(true)}
              />
              <div ref={turnstileContainerRef} />
            </div>
          )}

          {submitError && <p className="text-red-400 text-xs">{submitError}</p>}

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
              disabled={submitting || (!isEditing && !turnstileToken)}
              className="flex-1 py-2 text-sm text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#C8102E' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#a50d25')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#C8102E')}
            >
              {submitting ? 'Saving…' : isEditing ? 'Update Event' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
