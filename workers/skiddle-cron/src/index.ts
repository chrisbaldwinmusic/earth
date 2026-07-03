import { mapGenre } from './genre-map'

const SKIDDLE_BASE = 'https://www.skiddle.com/api/v1/events/search/'

// Confirmed against a live response (2026-07-03). Skiddle exposes many more
// fields than this; only what we use is typed here.
interface SkiddleVenue {
  name?: string
  town?: string
  latitude?: number
  longitude?: number
}

interface SkiddleEvent {
  id: string
  eventname: string
  cancelled?: string // '0' | '1'
  startdate?: string // ISO 8601 with explicit offset, e.g. '2026-07-03T18:00:00+00:00'
  venue?: SkiddleVenue
  link?: string
}

interface SkiddlePage {
  results?: SkiddleEvent[]
}

interface TransformedEvent {
  name: string
  venue: string
  city: string
  country: string
  genre: string
  date: string
  lat: number
  lng: number
  ticketUrl: string
  externalId: string
}

async function fetchPage(apiKey: string, offset: number, limit: number): Promise<SkiddlePage> {
  const params = new URLSearchParams({
    api_key: apiKey,
    country: 'GB',
    eventcode: 'LIVE,CLUB,FEST',
    limit: String(limit),
    offset: String(offset),
  })
  const res = await fetch(`${SKIDDLE_BASE}?${params}`)
  if (!res.ok) throw new Error(`Skiddle API returned ${res.status} at offset ${offset}`)
  return res.json()
}

function transformEvent(ev: SkiddleEvent): TransformedEvent | null {
  if (ev.cancelled && ev.cancelled !== '0') return null

  const lat = ev.venue?.latitude
  const lng = ev.venue?.longitude
  const date = ev.startdate ? new Date(ev.startdate).toISOString() : null

  if (!date || typeof lat !== 'number' || typeof lng !== 'number') return null

  return {
    name: ev.eventname,
    venue: ev.venue?.name ?? '',
    city: ev.venue?.town ?? '',
    // Skiddle's venue object only exposes an ISO country code ('GB'), and we
    // always query country=GB, so this is hardcoded rather than looked up.
    country: 'United Kingdom',
    // Skiddle's LIVE/CLUB/FEST results carry no structured genre field (only
    // EventCode, a coarse event-type, and free-text description/eventname) —
    // unlike Ticketmaster's classifications. Genre-map is a no-op for now;
    // every Skiddle event lands as 'Other' until/unless a genre signal shows up.
    genre: mapGenre(undefined),
    date,
    lat,
    lng,
    ticketUrl: ev.link ?? '',
    externalId: ev.id,
  }
}

async function run(env: Env): Promise<{ inserted: number; skipped: number }> {
  const limit = 100 // Skiddle's documented max page size
  const maxPages = parseInt(env.MAX_PAGES ?? '5', 10)
  let inserted = 0
  let skipped = 0

  for (let page = 0; page < maxPages; page++) {
    const offset = page * limit
    let data: SkiddlePage
    try {
      data = await fetchPage(env.SKIDDLE_API_KEY, offset, limit)
    } catch (err) {
      console.error(`[skiddle] Failed to fetch offset ${offset}:`, err)
      continue
    }

    const rawEvents = data.results ?? []
    if (rawEvents.length === 0) break

    for (const raw of rawEvents) {
      let event: TransformedEvent | null
      try {
        event = transformEvent(raw)
      } catch (err) {
        console.error('[skiddle] Failed to transform event:', err)
        skipped++
        continue
      }
      if (!event) {
        skipped++
        continue
      }

      const result = await env.DB.prepare(
        `INSERT OR IGNORE INTO events
           (id, name, venue, city, country, genre, date, lat, lng, source, ticket_link, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'skiddle', ?, ?)`,
      )
        .bind(
          crypto.randomUUID(),
          event.name,
          event.venue,
          event.city,
          event.country,
          event.genre,
          event.date,
          event.lat,
          event.lng,
          event.ticketUrl || null,
          // Prefixed to keep this namespace disjoint from Ticketmaster's
          // unprefixed external_id values in the shared global unique index.
          `skiddle:${event.externalId}`,
        )
        .run()

      if (result.meta.changes > 0) inserted++
      else skipped++
    }

    if (rawEvents.length < limit) break
  }

  return { inserted, skipped }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      run(env)
        .then((result) => console.log('[skiddle-ingest] done:', result))
        .catch((err) => console.error('[skiddle-ingest] fatal:', err)),
    )
  },
} satisfies ExportedHandler<Env>
