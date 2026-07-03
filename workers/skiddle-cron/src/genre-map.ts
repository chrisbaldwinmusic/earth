const VALID_GENRES = new Set([
  'Rock', 'Electronic', 'Folk', 'Country', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World',
])

// Maps Skiddle genre/category values to the app's genre list.
// TODO: populate once a real API response shows what genre vocabulary Skiddle
// actually exposes (likely free-text artist genre tags, not a controlled
// vocabulary like Ticketmaster's classifications).
const OVERRIDES: Record<string, string> = {}

export function mapGenre(skiddleGenre: string | undefined): string {
  if (!skiddleGenre) return 'Other'
  if (VALID_GENRES.has(skiddleGenre)) return skiddleGenre
  return OVERRIDES[skiddleGenre] ?? 'Other'
}
