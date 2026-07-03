import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { LineupEntry, MapEvent } from '@/types/events'

export function getDb() {
  return getCloudflareContext().env.DB
}

export function getEnv() {
  return getCloudflareContext().env
}

export interface EventRow {
  id: string
  name: string
  venue: string
  city: string
  country: string
  genre: string
  date: string
  lat: number
  lng: number
  source: 'seeded' | 'user' | 'ticketmaster'
  status: 'pending' | 'approved'
  ticket_link: string | null
  website_link: string | null
  lineup: string | null
  external_id: string | null
  edit_token: string | null
}

export function rowToMapEvent(row: EventRow): MapEvent {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    city: row.city,
    country: row.country,
    genre: row.genre,
    date: row.date,
    lat: row.lat,
    lng: row.lng,
    source: row.source,
    status: row.status,
    ticketLink: row.ticket_link ?? undefined,
    websiteLink: row.website_link ?? undefined,
    lineup: row.lineup ? (JSON.parse(row.lineup) as LineupEntry[]) : undefined,
  }
}
