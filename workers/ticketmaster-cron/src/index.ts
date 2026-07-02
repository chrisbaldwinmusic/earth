import { mapGenre } from './genre-map'

const TM_BASE = 'https://app.ticketmaster.com/discovery/v2/events.json'

interface TmVenue {
  name?: string
  city?: { name?: string }
  country?: { name?: string }
  location?: { latitude?: string; longitude?: string }
}

interface TmEvent {
  id: string
  name: string
  url?: string
  dates?: { start?: { dateTime?: string } }
  classifications?: { genre?: { name?: string } }[]
  _embedded?: { venues?: TmVenue[] }
}

interface TmPage {
  page?: { totalPages?: number }
  _embedded?: { events?: TmEvent[] }
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

async function fetchPage(apiKey: string, page: number): Promise<TmPage> {
  const params = new URLSearchParams({
    classificationName: 'music',
    size: '200',
    page: String(page),
    apikey: apiKey,
  })
  const res = await fetch(`${TM_BASE}?${params}`)
  if (!res.ok) throw new Error(`TM API returned ${res.status} on page ${page}`)
  return res.json()
}

function transformEvent(ev: TmEvent): TransformedEvent | null {
  const venue = ev._embedded?.venues?.[0]
  const lat = parseFloat(venue?.location?.latitude ?? '')
  const lng = parseFloat(venue?.location?.longitude ?? '')
  const date = ev.dates?.start?.dateTime

  if (!date || isNaN(lat) || isNaN(lng)) return null

  return {
    name: ev.name,
    venue: venue?.name ?? '',
    city: venue?.city?.name ?? '',
    country: venue?.country?.name ?? '',
    genre: mapGenre(ev.classifications?.[0]?.genre?.name),
    date,
    lat,
    lng,
    ticketUrl: ev.url ?? '',
    externalId: ev.id,
  }
}

async function run(env: Env): Promise<{ inserted: number; skipped: number }> {
  const maxPages = parseInt(env.MAX_PAGES ?? '5', 10)
  let inserted = 0
  let skipped = 0

  for (let page = 0; page < maxPages; page++) {
    let data: TmPage
    try {
      data = await fetchPage(env.TM_API_KEY, page)
    } catch (err) {
      console.error(`[TM] Failed to fetch page ${page}:`, err)
      continue
    }

    const rawEvents = data._embedded?.events ?? []
    const totalPages = data.page?.totalPages ?? 1

    for (const raw of rawEvents) {
      const event = transformEvent(raw)
      if (!event) {
        skipped++
        continue
      }

      const result = await env.DB.prepare(
        `INSERT OR IGNORE INTO events
           (id, name, venue, city, country, genre, date, lat, lng, source, ticket_link, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ticketmaster', ?, ?)`,
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
          event.externalId,
        )
        .run()

      if (result.meta.changes > 0) inserted++
      else skipped++
    }

    if (page >= totalPages - 1) break
  }

  return { inserted, skipped }
}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      run(env)
        .then((result) => console.log('[tm-ingest] done:', result))
        .catch((err) => console.error('[tm-ingest] fatal:', err)),
    )
  },
} satisfies ExportedHandler<Env>
