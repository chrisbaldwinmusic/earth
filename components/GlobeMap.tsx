'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import seedEvents from '@/data/events.json'
import AddEventModal from './AddEventModal'
import FilterBar from './FilterBar'
import Search from './Search'
import type { LineupEntry, MapEvent } from '@/types/events'

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
        ticketLink: e.ticketLink ?? null,
        websiteLink: e.websiteLink ?? null,
        lineup: e.lineup ? JSON.stringify(e.lineup) : null,
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
  const [pendingEdit, setPendingEdit] = useState<MapEvent | null>(null)

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
      style: 'mapbox://styles/mapbox/standard',
      projection: 'globe',
      zoom: 1.5,
      center: [0, 20],
    })

    map.current.on('style.load', () => {
      const m = map.current
      if (!m) return
      m.setConfigProperty('basemap', 'lightPreset', 'night')
      m.setConfigProperty('basemap', 'show3dObjects', true)
      m.setFog({
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
        slot: 'top',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#C8102E',
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
        slot: 'top',
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
        slot: 'top',
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
        slot: 'top',
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
        const geom = features[0].geometry
        if (geom.type !== 'Point') return
        const coords = geom.coordinates as [number, number]
        ;(m.getSource('events') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return
            m.flyTo({ center: coords, zoom })
          },
        )
      })

      // ── Click: individual point ─────────────────────────────────────────
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
          ticketLink: props.ticketLink ?? undefined,
          websiteLink: props.websiteLink ?? undefined,
          lineup: props.lineup ? (JSON.parse(props.lineup) as LineupEntry[]) : undefined,
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
  const handleEventSaved = useCallback((event: MapEvent) => {
    setUserEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id)
      const updated = exists ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event]
      saveUserEvents(updated)
      return updated
    })
    setPendingLocation(null)
    setPendingEdit(null)
  }, [])

  const handleDeleteEvent = useCallback((id: string) => {
    setUserEvents((prev) => {
      const updated = prev.filter((e) => e.id !== id)
      saveUserEvents(updated)
      return updated
    })
    setSelectedEvent(null)
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
        searchSlot={
          <Search
            token={token}
            onFlyTo={(center) => map.current?.flyTo({ center, zoom: 14 })}
          />
        }
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

      {pendingEdit && (
        <AddEventModal
          lat={pendingEdit.lat}
          lng={pendingEdit.lng}
          token={token}
          onSubmit={handleEventSaved}
          onClose={() => setPendingEdit(null)}
          initialEvent={pendingEdit}
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
              <div className="flex items-center gap-2 shrink-0">
                {selectedEvent.source === 'user' && (
                  <>
                    <button
                      onClick={() => { setPendingEdit(selectedEvent); setSelectedEvent(null) }}
                      className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(selectedEvent.id)}
                      className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-red-900/60 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-zinc-400 hover:text-white transition-colors mt-0.5"
                  aria-label="Close"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
                  </svg>
                </button>
              </div>
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
              {selectedEvent.ticketLink && (
                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-xs">Tickets</span>
                  <p className="mt-0.5">
                    <a
                      href={selectedEvent.ticketLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Buy tickets →
                    </a>
                  </p>
                </div>
              )}
              {selectedEvent.websiteLink && (
                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-xs">Website</span>
                  <p className="mt-0.5">
                    <a
                      href={selectedEvent.websiteLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      {new URL(selectedEvent.websiteLink).hostname.replace('www.', '')} →
                    </a>
                  </p>
                </div>
              )}
            </div>

            {selectedEvent.lineup && selectedEvent.lineup.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <span className="text-zinc-500 uppercase tracking-wider text-xs">Lineup</span>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                  {[...selectedEvent.lineup]
                    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
                    .map((entry, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-sm">
                        {entry.time && (
                          <span className="text-zinc-500 tabular-nums text-xs">{entry.time}</span>
                        )}
                        <span className="text-zinc-200">{entry.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
