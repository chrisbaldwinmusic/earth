const VALID_GENRES = new Set([
  'Rock', 'Electronic', 'Folk', 'Country', 'Jazz', 'Classical',
  'Hip-Hop', 'Pop', 'Metal', 'World',
])

// Maps Skiddle genre/category values to the app's genre list.
// Confirmed against a live response (2026-07-03): Skiddle's LIVE/CLUB/FEST
// event search results carry no structured genre field at all — only
// EventCode (a coarse event-type: LIVE/CLUB/FEST/etc, not a music genre) and
// free-text eventname/description. So this always returns 'Other' for now;
// left as a real function (not a constant) in case a genre signal turns up
// in a future response inspection or a different Skiddle endpoint.
const OVERRIDES: Record<string, string> = {}

export function mapGenre(skiddleGenre: string | undefined): string {
  if (!skiddleGenre) return 'Other'
  if (VALID_GENRES.has(skiddleGenre)) return skiddleGenre
  return OVERRIDES[skiddleGenre] ?? 'Other'
}
