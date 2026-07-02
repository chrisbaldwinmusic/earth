import { getDb, rowToMapEvent, type EventRow } from '@/lib/db'
import { GENRES } from '@/lib/genres'
import type { LineupEntry } from '@/types/events'

export const dynamic = 'force-dynamic'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

async function loadOwnedEvent(id: string, editToken: string | null) {
  const db = getDb()
  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRow>()
  if (!row || row.source !== 'user') {
    return { error: Response.json({ error: 'Not found' }, { status: 404 }) } as const
  }
  if (!editToken || row.edit_token !== editToken) {
    return { error: Response.json({ error: 'Invalid edit token' }, { status: 403 }) } as const
  }
  return { db, row } as const
}

interface UpdateEventBody {
  name?: unknown
  venue?: unknown
  city?: unknown
  country?: unknown
  genre?: unknown
  date?: unknown
  lat?: unknown
  lng?: unknown
  ticketLink?: unknown
  websiteLink?: unknown
  lineup?: unknown
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const editToken = request.headers.get('X-Edit-Token')
  const owned = await loadOwnedEvent(id, editToken)
  if ('error' in owned) return owned.error
  const { db } = owned

  const body = (await request.json()) as UpdateEventBody
  const { name, venue, city, country, genre, date, lat, lng, ticketLink, websiteLink, lineup } = body

  if (
    !isNonEmptyString(name) ||
    !isNonEmptyString(venue) ||
    !isNonEmptyString(city) ||
    !isNonEmptyString(country) ||
    !isNonEmptyString(date) ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return Response.json({ error: 'Missing or invalid required fields' }, { status: 400 })
  }
  if (!GENRES.includes(genre as (typeof GENRES)[number])) {
    return Response.json({ error: 'Invalid genre' }, { status: 400 })
  }

  const lineupJson =
    Array.isArray(lineup) && (lineup as LineupEntry[]).length > 0 ? JSON.stringify(lineup) : null

  await db
    .prepare(
      `UPDATE events SET name = ?, venue = ?, city = ?, country = ?, genre = ?, date = ?, lat = ?, lng = ?,
         ticket_link = ?, website_link = ?, lineup = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
    .bind(
      name,
      venue,
      city,
      country,
      genre,
      date,
      lat,
      lng,
      isNonEmptyString(ticketLink) ? ticketLink : null,
      isNonEmptyString(websiteLink) ? websiteLink : null,
      lineupJson,
      id,
    )
    .run()

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRow>()
  return Response.json(rowToMapEvent(row as EventRow))
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const editToken = request.headers.get('X-Edit-Token')
  const owned = await loadOwnedEvent(id, editToken)
  if ('error' in owned) return owned.error
  const { db } = owned

  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
