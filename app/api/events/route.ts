import { getDb, getEnv, rowToMapEvent, type EventRow } from '@/lib/db'
import { verifyTurnstile } from '@/lib/turnstile'
import { GENRES } from '@/lib/genres'
import type { LineupEntry } from '@/types/events'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = getDb()
  const { results } = await db
    .prepare("SELECT * FROM events WHERE status = 'approved' ORDER BY date ASC")
    .all<EventRow>()
  return Response.json(results.map(rowToMapEvent))
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
  'cf-turnstile-response'?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateEventBody

  const turnstileToken = body['cf-turnstile-response']
  if (!isNonEmptyString(turnstileToken)) {
    return Response.json({ error: 'Missing Turnstile token' }, { status: 400 })
  }

  const ip = request.headers.get('CF-Connecting-IP')
  const verified = await verifyTurnstile(turnstileToken, ip, getEnv().TURNSTILE_SECRET)
  if (!verified) {
    return Response.json({ error: 'Turnstile verification failed' }, { status: 403 })
  }

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
  const editToken = crypto.randomUUID()
  const lineupJson =
    Array.isArray(lineup) && (lineup as LineupEntry[]).length > 0 ? JSON.stringify(lineup) : null

  const db = getDb()
  await db
    .prepare(
      `INSERT INTO events (id, name, venue, city, country, genre, date, lat, lng, source, status, ticket_link, website_link, lineup, edit_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user', 'pending', ?, ?, ?, ?)`,
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
      editToken,
    )
    .run()

  return Response.json(
    {
      event: {
        id,
        name,
        venue,
        city,
        country,
        genre,
        date,
        lat,
        lng,
        source: 'user',
        status: 'pending',
        ticketLink: isNonEmptyString(ticketLink) ? ticketLink : undefined,
        websiteLink: isNonEmptyString(websiteLink) ? websiteLink : undefined,
        lineup: lineupJson ? JSON.parse(lineupJson) : undefined,
      },
      editToken,
    },
    { status: 201 },
  )
}
