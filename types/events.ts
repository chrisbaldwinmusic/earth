export interface MapEvent {
  id: string
  name: string
  venue: string
  city: string
  country: string
  genre: string
  date: string
  lat: number
  lng: number
  source: 'seeded' | 'user'
  ticketLink?: string
  websiteLink?: string
}
