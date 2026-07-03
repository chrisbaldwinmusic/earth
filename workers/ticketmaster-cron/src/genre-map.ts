const VALID_GENRES = new Set([
  'Rock', 'Electronic', 'Folk', 'Country', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World',
])

// Maps Ticketmaster genre names to the app's genre list.
const OVERRIDES: Record<string, string> = {
  'Alternative': 'Rock',
  'Indie': 'Rock',
  'Punk': 'Rock',
  'Hard Rock': 'Rock',
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

export function mapGenre(tmGenre: string | undefined): string {
  if (!tmGenre) return 'Other'
  if (VALID_GENRES.has(tmGenre)) return tmGenre
  return OVERRIDES[tmGenre] ?? 'Other'
}
