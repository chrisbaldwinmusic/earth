'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import seedEvents from '@/data/events.json'
import AddEventModal from './AddEventModal'
import FilterBar from './FilterBar'
import type { MapEvent } from '@/types/events'

const LS_KEY = 'sb-music-map-events'

function loadUserEvents(): MapEvent[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as MapEvent[]).map((e) => ({ ...e, source: 'user' as const }))
  } catch {
    return []
  }
}

function saveUserEvents(events: MapEvent[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(events))
}

function toGeoJSON(events: MapEvent[]) {
  return {
    type: 'FeatureCollection' as const,
    features: events.map((e) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] as [number, number] },
      properties: {
        id: e.id,
        name: e.name,
        venue: e.venue,
        city: e.city,
        country: e.country,
        genre: e.genre,
        date: e.date,
        lat: e.lat,
        lng: e.lng,
        source: e.source,
      },
    })),
  }
}

export default function GlobeMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [userEvents, setUserEvents] = useState<MapEvent[]>(() => loadUserEvents())
  const [genreFilter, setGenreFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

  const allEvents = useMemo<MapEvent[]>(
    () => [
      ...(seedEvents as Omit<MapEvent, 'source'>[]).map((e) => ({
        ...e,
        source: 'seeded' as const,
      })),
      ...userEvents,
    ],
    [userEvents],
  )

  const filteredEvents = useMemo(
    () =>
      allEvents.filter((e) => {
        if (genreFilter && e.genre !== genreFilter) return false
        const d = e.date.slice(0, 10)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      }),
    [allEvents, genreFilter, dateFrom, dateTo],
  )

  const hasActiveFilters = Boolean(genreFilter || dateFrom || dateTo)

  // Keep a ref so the async map.on('load') callback always sees current filtered data
  const filteredEventsRef = useRef(filteredEvents)
  filteredEventsRef.current = filteredEvents

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return

    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      projection: 'globe',
      zoom: 1.5,
      center: [0, 20],
    })

    map.current.on('style.load', () => {
      map.current?.setFog({
        color: 'rgb(10, 10, 30)',
        'high-color': 'rgb(20, 20, 60)',
        'horizon-blend': 0.05,
        'space-color': 'rgb(5, 5, 20)',
        'star-intensity': 0.8,
      })
    })

    map.current.on('load', () => {
      const m = map.current
      if (!m) return

      // ── GeoJSON source with clustering ──────────────────────────────────
      m.addSource('events', {
        type: 'geojson',
        data: toGeoJSON(filteredEventsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      })

      // Cluster circles — radius scales with point_count
      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#C8102E',
          // step: default 15, ≥10 → 20, ≥30 → 25  (diameters 30/40/50px)
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ff6b6b',
        },
      })

      // Cluster count labels
      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      })

      // Soft glow behind individual points
      m.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 11,
          'circle-color': ['match', ['get', 'source'], 'user', '#C8102E', '#ffffff'],
          'circle-opacity': 0.18,
          'circle-blur': 1,
        },
      })

      // Individual unclustered points
      m.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get', 'source'], 'user', '#C8102E', '#ffffff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'match',
            ['get', 'source'],
            'user',
            '#ff6b6b',
            'rgba(255,255,255,0.45)',
          ],
        },
      })

      // ── Click: cluster → fly in to expand ──────────────────────────────
      m.on('click', 'clusters', (e) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0]?.properties?.cluster_id as number | undefined
        if (clusterId == null) return
        const coords = (features[0].geometry as { coordinates: [number, number] }).coordinates
        ;(m.getSource('events') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return
            m.flyTo({ center: coords, zoom })
          },
        )
      })

      // ── Click: individual point → detail panel ──────────────────────────
      m.on('click', 'unclustered-point', (e) => {
        const props = e.features?.[0]?.properties
        if (!props) return
        setSelectedEvent({
          id: props.id,
          name: props.name,
          venue: props.venue,
          city: props.city,
          country: props.country,
          genre: props.genre,
          date: props.date,
          lat: props.lat,
          lng: props.lng,
          source: props.source as 'seeded' | 'user',
        })
      })

      // ── Cursor: pointer on interactive layers ───────────────────────────
      ;(['clusters', 'unclustered-point'] as const).forEach((layer) => {
        m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
      })

      // ── Click: empty map → add-event modal ─────────────────────────────
      m.on('click', (e) => {
        const hit = m.queryRenderedFeatures(e.point, {
          layers: ['clusters', 'unclustered-point'],
        })
        if (hit.length === 0) {
          setPendingLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        }
      })

      setMapReady(true)
    })

    return () => {
      map.current?.remove()
    }
  }, [token])

  // ── Sync filtered events → GeoJSON source ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !map.current) return
    ;(map.current.getSource('events') as mapboxgl.GeoJSONSource | undefined)?.setData(
      toGeoJSON(filteredEvents),
    )
  }, [filteredEvents, mapReady])

  // ── Detail panel: close on outside mousedown ──────────────────────────────
  useEffect(() => {
    if (!selectedEvent || pendingLocation) return
    const handle = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSelectedEvent(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [selectedEvent, pendingLocation])

  // ── Save new user event ───────────────────────────────────────────────────
  const handleEventSaved = useCallback((newEvent: MapEvent) => {
    setUserEvents((prev) => {
      const updated = [...prev, newEvent]
      saveUserEvents(updated)
      return updated
    })
    setPendingLocation(null)
  }, [])

  const hasTime = selectedEvent?.date.includes('T')
  const formattedDate = selectedEvent
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}),
        timeZone: 'UTC',
      }).format(new Date(selectedEvent.date))
    : ''

  return (
    <>
      <FilterBar
        genreFilter={genreFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        hasActiveFilters={hasActiveFilters}
        onGenreChange={setGenreFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onClear={() => {
          setGenreFilter('')
          setDateFrom('')
          setDateTo('')
        }}
      />

      <div ref={mapContainer} style={{ width: '100vw', height: '100vh' }} />

      {pendingLocation && (
        <AddEventModal
          lat={pendingLocation.lat}
          lng={pendingLocation.lng}
          token={token}
          onSubmit={handleEventSaved}
          onClose={() => setPendingLocation(null)}
        />
      )}

      {selectedEvent && (
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-700 px-6 pt-5 pb-8 animate-slide-up"
          style={{ maxHeight: '40vh' }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 pr-4">
                <h2 className="text-white text-xl font-semibold leading-tight">
                  {selectedEvent.name}
                </h2>
                {selectedEvent.source === 'user' && (
                  <span
                    className="shrink-0 text-xs px-2 py-0.5 rounded-full border"
                    style={{
                      color: '#ff6b6b',
                      borderColor: '#C8102E',
                      backgroundColor: 'rgba(200,16,46,0.12)',
                    }}
                  >
                    your event
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-zinc-400 hover:text-white transition-colors shrink-0 mt-0.5"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-xs">Venue</span>
                <p className="text-zinc-200 mt-0.5">{selectedEvent.venue}</p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-xs">Location</span>
                <p className="text-zinc-200 mt-0.5">
                  {selectedEvent.city}, {selectedEvent.country}
                </p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-xs">Date</span>
                <p className="text-zinc-200 mt-0.5">{formattedDate}</p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase tracking-wider text-xs">Genre</span>
                <p className="text-zinc-200 mt-0.5">{selectedEvent.genre}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
