// One-time script: reads data/events.json and emits migrations/0002_seed_events.sql.
// Not part of the deployed app — run manually, then delete once the seed migration is applied.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const VALID_GENRES = new Set([
  'Rock', 'Electronic', 'Folk', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World', 'Other',
])

// Mirrors workers/ticketmaster-cron/src/genre-map.ts's exact-match overrides.
const OVERRIDES = {
  'Alternative': 'Rock',
  'Indie': 'Rock',
  'Punk': 'Rock',
  'Hard Rock': 'Rock',
  'Country': 'Folk',
  'Bluegrass': 'Folk',
  'Blues': 'Folk',
  'R&B': 'Pop',
  'Soul': 'Pop',
  'Dance': 'Electronic',
  'House': 'Electronic',
  'Techno': 'Electronic',
  'EDM': 'Electronic',
  'Rap': 'Hip-Hop',
  'Latin': 'World',
  'Reggae': 'World',
  'Afrobeats': 'World',
  'Gospel': 'World',
  'New Age': 'Classical',
  'Opera': 'Classical',
}

// Seed data has richer free-text genres (e.g. "Industrial Techno", "Indie / Electronic")
// than Ticketmaster's single canonical classification names, so exact-match isn't enough —
// fall back to keyword matching, checked in priority order.
const KEYWORD_FALLBACKS = [
  [/techno|house|dance|edm|trance|electronic|drum\s*&\s*bass|dnb/i, 'Electronic'],
  [/indie|alternative|punk|hard rock|rock/i, 'Rock'],
  [/folk|country|bluegrass|blues/i, 'Folk'],
  [/jazz/i, 'Jazz'],
  [/classical|opera|new age/i, 'Classical'],
  [/hip-hop|hip hop|rap/i, 'Hip-Hop'],
  [/pop|r&b|soul/i, 'Pop'],
  [/metal/i, 'Metal'],
  [/world|latin|reggae|afrobeat|gospel/i, 'World'],
]

function mapGenre(rawGenre) {
  if (!rawGenre) return 'Other'
  if (VALID_GENRES.has(rawGenre)) return rawGenre
  if (OVERRIDES[rawGenre]) return OVERRIDES[rawGenre]
  for (const [pattern, genre] of KEYWORD_FALLBACKS) {
    if (pattern.test(rawGenre)) return genre
  }
  return 'Other'
}

function sqlString(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

const events = JSON.parse(await readFile(path.join(rootDir, 'data/events.json'), 'utf-8'))

const statements = events.map((e) => {
  const genre = mapGenre(e.genre)
  const columns = [
    'id', 'name', 'venue', 'city', 'country', 'genre', 'date', 'lat', 'lng',
    'source', 'ticket_link', 'website_link', 'lineup', 'external_id',
  ]
  const values = [
    sqlString(e.id), sqlString(e.name), sqlString(e.venue), sqlString(e.city),
    sqlString(e.country), sqlString(genre), sqlString(e.date), e.lat, e.lng,
    "'seeded'", sqlString(e.ticketLink ?? null), sqlString(e.websiteLink ?? null),
    sqlString(e.lineup ? JSON.stringify(e.lineup) : null), 'NULL',
  ]
  if (genre !== e.genre) {
    console.log(`Remapped "${e.name}": "${e.genre}" -> "${genre}"`)
  }
  return `INSERT INTO events (${columns.join(', ')}) VALUES (${values.join(', ')});`
})

const sql = `-- Seed data migrated from data/events.json, genres remapped to the fixed genre list.\n\n${statements.join('\n')}\n`
const outPath = path.join(rootDir, 'migrations/0002_seed_events.sql')
await writeFile(outPath, sql)
console.log(`\nWrote ${statements.length} INSERT statements to ${outPath}`)
