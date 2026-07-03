'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MapEvent } from '@/types/events'

const PASSWORD_KEY = 'sb-music-map-admin-password'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function AdminPanel() {
  const [password, setPassword] = useState<string | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [events, setEvents] = useState<MapEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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
    } catch {
      setActionError('Failed to delete event')
    } finally {
      setBusyId(null)
    }
  }

  if (!password) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
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

  const pending = events?.filter((e) => e.status === 'pending') ?? []
  const approved = events?.filter((e) => e.status !== 'pending') ?? []

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-xl font-semibold">Event moderation</h1>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            Log out
          </button>
        </div>

        {actionError && <p className="text-red-400 text-sm mb-4">{actionError}</p>}
        {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

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
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3"
              >
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
                    onClick={() => handleDelete(event.id)}
                    disabled={busyId === event.id}
                    className="bg-red-700/80 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                  >
                    Reject
                  </button>
                </div>
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
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{event.name}</p>
                  <p className="text-zinc-500 text-xs truncate">
                    {event.venue}, {event.city}, {event.country} · {event.genre} ·{' '}
                    {fmtDate(event.date)} · {event.source}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(event.id)}
                  disabled={busyId === event.id}
                  className="shrink-0 bg-red-700/80 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
