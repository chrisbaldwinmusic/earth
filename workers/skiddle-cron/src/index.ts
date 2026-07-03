// NB: transformEvent below should call mapGenre from './genre-map' once its
// field mapping is filled in — not imported yet since it's currently unused.

const SKIDDLE_BASE = 'https://www.skiddle.com/api/v1/events/search/'

// TODO once we have a real API key and can inspect a live response: confirm
// actual field names/nesting below. This interface is a placeholder based on
// documented request params only — the response shape is unconfirmed.
interface SkiddleEvent {
  id: string
}

interface SkiddlePage {
  // TODO: confirm pagination metadata field name(s), e.g. totalcount / total
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
    eventcode: 'LIVE', // TODO: confirm whether CLUB/FEST should also be included
    limit: String(limit),
    offset: String(offset),
  })
  const res = await fetch(`${SKIDDLE_BASE}?${params}`)
  if (!res.ok) throw new Error(`Skiddle API returned ${res.status} at offset ${offset}`)
  return res.json()
}

// TODO once we have a real API key and can inspect a live response: this is a
// placeholder skeleton — field names below are not confirmed.
function transformEvent(_ev: SkiddleEvent): TransformedEvent | null {
  throw new Error('not implemented — pending live Skiddle API response inspection')
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
