'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LineupEntry, MapEvent } from '@/types/events'
import { GENRES } from '@/lib/genres'
import EmbedButton from './EmbedButton'

const PASSWORD_KEY = 'sb-music-map-admin-password'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

interface EditDraft {
  name: string
  venue: string
  city: string
  country: string
  genre: string
  date: string
  lat: string
  lng: string
  ticketLink: string
  websiteLink: string
  lineup: LineupEntry[]
}

function toDraft(event: MapEvent): EditDraft {
  return {
    name: event.name,
    venue: event.venue,
    city: event.city,
    country: event.country,
    genre: event.genre,
    date: event.date,
    lat: String(event.lat),
    lng: String(event.lng),
    ticketLink: event.ticketLink ?? '',
    websiteLink: event.websiteLink ?? '',
    lineup: event.lineup ?? [],
  }
}

const inputClass =
  'w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-zinc-500'
const labelClass = 'block text-zinc-500 text-xs mb-1'

function EditForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: EditDraft
  onChange: (draft: EditDraft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
}) {
  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name</label>
          <input
            className={inputClass}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Venue</label>
          <input
            className={inputClass}
            value={draft.venue}
            onChange={(e) => onChange({ ...draft, venue: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>City</label>
          <input
            className={inputClass}
            value={draft.city}
            onChange={(e) => onChange({ ...draft, city: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Country</label>
          <input
            className={inputClass}
            value={draft.country}
            onChange={(e) => onChange({ ...draft, country: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Genre</label>
          <select
            className={inputClass}
            value={draft.genre}
            onChange={(e) => onChange({ ...draft, genre: e.target.value })}
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <input
            className={inputClass}
            value={draft.date}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
        </div>
        <div>
          <label className={labelClass}>Lat</label>
          <input
            className={inputClass}
            type="number"
            step="any"
            value={draft.lat}
            onChange={(e) => onChange({ ...draft, lat: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Lng</label>
          <input
            className={inputClass}
            type="number"
            step="any"
            value={draft.lng}
            onChange={(e) => onChange({ ...draft, lng: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Ticket link</label>
          <input
            className={inputClass}
            value={draft.ticketLink}
            onChange={(e) => onChange({ ...draft, ticketLink: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Website link</label>
          <input
            className={inputClass}
            value={draft.websiteLink}
            onChange={(e) => onChange({ ...draft, websiteLink: e.target.value })}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass + ' mb-0'}>Lineup</label>
          <button
            type="button"
            onClick={() => onChange({ ...draft, lineup: [...draft.lineup, { name: '', time: '' }] })}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            + Add performer
          </button>
        </div>
        {draft.lineup.length === 0 ? (
          <p className="text-zinc-600 text-xs py-1">No lineup.</p>
        ) : (
          <div className="space-y-2">
            {draft.lineup.map((entry, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className={inputClass + ' flex-1 min-w-0'}
                  value={entry.name}
                  placeholder="Performer name"
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      lineup: draft.lineup.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  className={inputClass + ' w-28 shrink-0'}
                  type="time"
                  value={entry.time ?? ''}
                  style={{ colorScheme: 'dark' }}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      lineup: draft.lineup.map((x, j) =>
                        j === i ? { ...x, time: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...draft, lineup: draft.lineup.filter((_, j) => j !== i) })
                  }
                  className="text-zinc-500 hover:text-red-400 transition-colors shrink-0 text-xs"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-green-700/80 hover:bg-green-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-zinc-400 hover:text-white text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const [password, setPassword] = useState<string | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [events, setEvents] = useState<MapEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all' | MapEvent['source']>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const fetchEvents = useCallback(async (pw: string) => {
    setLoading(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/admin/events', {
        headers: { 'X-Admin-Password': pw },
      })
      if (res.status === 401) {
        localStorage.removeItem(PASSWORD_KEY)
        setPassword(null)
        setLoginError('Incorrect password')
        return
      }
      if (!res.ok) throw new Error('Failed to load events')
      setEvents((await res.json()) as MapEvent[])
      setPassword(pw)
      localStorage.setItem(PASSWORD_KEY, pw)
    } catch {
      setLoginError('Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(PASSWORD_KEY)
    if (stored) fetchEvents(stored)
  }, [fetchEvents])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordInput.trim()) return
    fetchEvents(passwordInput.trim())
  }

  const handleLogout = () => {
    localStorage.removeItem(PASSWORD_KEY)
    setPassword(null)
    setEvents(null)
    setPasswordInput('')
  }

  const handleApprove = async (id: string) => {
    if (!password) return
    setBusyId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'PATCH',
        headers: { 'X-Admin-Password': password },
      })
      if (!res.ok) throw new Error('Failed to approve')
      setEvents((prev) =>
        prev ? prev.map((e) => (e.id === id ? { ...e, status: 'approved' } : e)) : prev,
      )
    } catch {
      setActionError('Failed to approve event')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!password) return
    if (!confirm('Delete this event permanently?')) return
    setBusyId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      })
      if (!res.ok) throw new Error('Failed to delete')
      setEvents((prev) => (prev ? prev.filter((e) => e.id !== id) : prev))
      if (editingId === id) {
        setEditingId(null)
        setEditDraft(null)
      }
    } catch {
      setActionError('Failed to delete event')
    } finally {
      setBusyId(null)
    }
  }

  const startEdit = (event: MapEvent) => {
    setEditingId(event.id)
    setEditDraft(toDraft(event))
    setEditError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!password || !editingId || !editDraft) return
    const lat = parseFloat(editDraft.lat)
    const lng = parseFloat(editDraft.lng)
    if (
      !editDraft.name.trim() ||
      !editDraft.venue.trim() ||
      !editDraft.city.trim() ||
      !editDraft.country.trim() ||
      !editDraft.date.trim() ||
      isNaN(lat) ||
      isNaN(lng)
    ) {
      setEditError('Missing or invalid required fields')
      return
    }

    setSaving(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/admin/events/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          venue: editDraft.venue.trim(),
          city: editDraft.city.trim(),
          country: editDraft.country.trim(),
          genre: editDraft.genre,
          date: editDraft.date.trim(),
          lat,
          lng,
          ticketLink: editDraft.ticketLink.trim() || undefined,
          websiteLink: editDraft.websiteLink.trim() || undefined,
          lineup: editDraft.lineup.filter((entry) => entry.name.trim()),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = (await res.json()) as MapEvent
      setEvents((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev))
      setEditingId(null)
      setEditDraft(null)
    } catch {
      setEditError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const filteredEvents = useMemo(() => {
    if (!events) return []
    let result = events
    if (sourceFilter !== 'all') {
      result = result.filter((e) => e.source === sourceFilter)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter((e) =>
        [e.name, e.venue, e.city, e.country, e.genre, e.source].some((field) =>
          field.toLowerCase().includes(q),
        ),
      )
    }
    return result
  }, [events, query, sourceFilter])

  if (!password) {
    return (
      <main className="h-screen overflow-y-auto bg-zinc-950 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        >
          <h1 className="text-white text-lg font-semibold mb-4">Admin login</h1>
          <input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Admin password"
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-md px-3 py-2 mb-3 focus:outline-none focus:border-zinc-500"
          />
          {loginError && <p className="text-red-400 text-sm mb-3">{loginError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-700/80 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-md py-2 transition-colors"
          >
            {loading ? 'Checking…' : 'Log in'}
          </button>
        </form>
      </main>
    )
  }

  const pending = filteredEvents.filter((e) => e.status === 'pending')
  const approved = filteredEvents.filter((e) => e.status !== 'pending')

  return (
    <main className="h-screen overflow-y-auto bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-xl font-semibold">Event moderation</h1>
          <div className="flex items-center gap-4">
            <EmbedButton className="text-xs px-2.5 py-1.5 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-white transition-colors" />
            <button
              onClick={handleLogout}
              className="text-zinc-500 hover:text-white text-sm transition-colors"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, venue, city, country, genre, source…"
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-zinc-500"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            className="bg-zinc-900 border border-zinc-800 text-white text-sm rounded-md px-3 py-2 focus:outline-none focus:border-zinc-500"
          >
            <option value="all">All sources</option>
            <option value="user">Registered by owners</option>
            <option value="seeded">Seeded</option>
            <option value="ticketmaster">Ticketmaster</option>
            <option value="skiddle">Skiddle</option>
          </select>
        </div>

        {actionError && <p className="text-red-400 text-sm mb-4">{actionError}</p>}
        {loading && <p className="text-zinc-500 text-sm">Loading…</p>}
        {!loading && events && (query.trim() || sourceFilter !== 'all') && (
          <p className="text-zinc-600 text-xs mb-4">
            {filteredEvents.length} of {events.length} events match
          </p>
        )}

        <section className="mb-8">
          <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wide mb-2">
            Pending approval ({pending.length})
          </h2>
          {pending.length === 0 && !loading && (
            <p className="text-zinc-600 text-sm">Nothing pending.</p>
          )}
          <ul className="space-y-2">
            {pending.map((event) => (
              <li
                key={event.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{event.name}</p>
                    <p className="text-zinc-500 text-xs truncate">
                      {event.venue}, {event.city}, {event.country} · {event.genre} ·{' '}
                      {fmtDate(event.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(event.id)}
                      disabled={busyId === event.id}
                      className="bg-green-700/80 hover:bg-green-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => startEdit(event)}
                      className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={busyId === event.id}
                      className="bg-red-700/80 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
                {editingId === event.id && editDraft && (
                  <EditForm
                    draft={editDraft}
                    onChange={setEditDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                    error={editError}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wide mb-2">
            Live events ({approved.length})
          </h2>
          <ul className="space-y-2">
            {approved.map((event) => (
              <li
                key={event.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{event.name}</p>
                    <p className="text-zinc-500 text-xs truncate">
                      {event.venue}, {event.city}, {event.country} · {event.genre} ·{' '}
                      {fmtDate(event.date)} · {event.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(event)}
                      className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      disabled={busyId === event.id}
                      className="bg-red-700/80 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {editingId === event.id && editDraft && (
                  <EditForm
                    draft={editDraft}
                    onChange={setEditDraft}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                    error={editError}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
