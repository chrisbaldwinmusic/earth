import { getDb, getEnv, rowToMapEvent, type EventRow } from '@/lib/db'
import { isAdminAuthorized } from '@/lib/admin'
import { GENRES } from '@/lib/genres'
import type { LineupEntry } from '@/types/events'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isAdminAuthorized(request, getEnv().ADMIN_PASSWORD)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const { results } = await db
    .prepare("SELECT * FROM events ORDER BY (status = 'pending') DESC, date ASC")
    .all<EventRow>()
  return Response.json(results.map(rowToMapEvent))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

interface CreateEventBody {
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

// Admin-created events (e.g. a new festival stage) skip Turnstile/moderation —
// they're approved immediately and stored as 'seeded', matching how the other
// festival-stage rows (mainstage/aftershocks) were originally added.
export async function POST(request: Request) {
  if (!isAdminAuthorized(request, getEnv().ADMIN_PASSWORD)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as CreateEventBody
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

  const id = crypto.randomUUID()
  const lineupJson =
    Array.isArray(lineup) && (lineup as LineupEntry[]).length > 0 ? JSON.stringify(lineup) : null

  const db = getDb()
  await db
    .prepare(
      `INSERT INTO events (id, name, venue, city, country, genre, date, lat, lng, source, status, ticket_link, website_link, lineup)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seeded', 'approved', ?, ?, ?)`,
    )
    .bind(
      id,
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
    )
    .run()

  const row = await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<EventRow>()
  return Response.json(rowToMapEvent(row as EventRow), { status: 201 })
}
