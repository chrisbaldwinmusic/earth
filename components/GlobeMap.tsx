'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import AddEventModal from './AddEventModal'
import FilterBar from './FilterBar'
import Search from './Search'
import InfoPanel from './InfoPanel'
import Legend from './Legend'
import EmbedButton from './EmbedButton'
import type { LineupEntry, MapEvent } from '@/types/events'

// Same key AdminPanel caches its password under — if it's present, this browser
// is treated as admin and can drag festival-stage pins to reposition them.
const ADMIN_PASSWORD_KEY = 'sb-music-map-admin-password'

// Sonic Boom Festival stage ids — matched by id (not name) since names get
// edited via /admin over time. Daytime stages get a star pin, the evening
// "aftershock" stages get a diamond pin, and every other event (independent)
// gets a plain teal circle. See the Legend component.
const DAYTIME_STAGE_IDS = [
  '331be109-1510-4690-9d0e-b8fa72a09ba4', // Main Stage
  '3ec412fc-6b1e-40b3-aec4-9a85d49bc392', // The Brewers / Market Hall Stage
  'f38a705f-b1c4-4d6f-9d64-9a39e4b02797', // Busk Stop
]
const AFTERSHOCK_STAGE_IDS = [
  '11371a92-be0c-46dd-9d0a-f9b04d64cb0e', // EMOM
  '61cf99c9-887a-4e49-98fb-5d3218523486', // Arcadia
  '3e33eed6-f342-49fe-ab7f-1402b2503757', // Rock Bar
  '4ee08f88-fc1a-4736-a5fc-d6964c67d424', // Barrel
  '351b8395-ce3b-4a4a-ba65-0e4d33a0b78d', // BBC Introducing
]
const MAINSTAGE_ID = '331be109-1510-4690-9d0e-b8fa72a09ba4'
const FESTIVAL_STAGE_IDS = [...DAYTIME_STAGE_IDS, ...AFTERSHOCK_STAGE_IDS]

// Vector pin icons drawn straight to canvas (no emoji) so each event category
// gets its own shape + colour as a Mapbox GL icon-image.
function createStarIcon(size = 64): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.42
  const innerR = size * 0.18
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (Math.PI / 5) * i - Math.PI / 2
    const x = cx + r * Math.cos(angle)
    const y = cy + r * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#FFC53D'
  ctx.fill()
  ctx.lineWidth = size * 0.06
  ctx.strokeStyle = '#8a5a00'
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function createDiamondIcon(size = 64): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.36
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.closePath()
  ctx.fillStyle = '#A855F7'
  ctx.fill()
  ctx.lineWidth = size * 0.06
  ctx.strokeStyle = '#4c1d78'
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function toGeoJSON(events: MapEvent[]) {
  return {
    type: 'FeatureCollection' as const,
    features: events.map((e) => {
      const isDaytime = DAYTIME_STAGE_IDS.includes(e.id)
      const isAftershock = !isDaytime && AFTERSHOCK_STAGE_IDS.includes(e.id)
      // Every pin is exactly one of these three, shown in the map legend:
      // a Sonic Boom daytime stage, a Sonic Boom aftershock stage, or an
      // independent event (Skiddle-ingested or community-submitted alike).
      const category = isDaytime ? 'mainstage' : isAftershock ? 'aftershock' : 'independent'
      return {
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
          category,
          ticketLink: e.ticketLink ?? null,
          websiteLink: e.websiteLink ?? null,
          lineup: e.lineup ? JSON.stringify(e.lineup) : null,
        },
      }
    }),
  }
}

export default function GlobeMap({ readOnly = false }: { readOnly?: boolean } = {}) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null)
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [allEvents, setAllEvents] = useState<MapEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [genreFilter, setGenreFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
  const [pendingEdit, setPendingEdit] = useState<MapEvent | null>(null)
  const [pendingLocationPrefill, setPendingLocationPrefill] = useState<{
    venue: string; city: string; country: string
  } | null>(null)

  // Admin password cached by AdminPanel — presence unlocks dragging pins to
  // reposition them and editing/deleting any event straight from the map,
  // not just ones this browser created. Server still checks it on every save.
  const [adminPassword, setAdminPasswordState] = useState<string | null>(null)
  const adminPasswordRef = useRef<string | null>(null)
  const setAdminPassword = useCallback((pw: string | null) => {
    adminPasswordRef.current = pw
    setAdminPasswordState(pw)
  }, [])
  useEffect(() => {
    if (readOnly) return
    setAdminPassword(localStorage.getItem(ADMIN_PASSWORD_KEY))
  }, [readOnly, setAdminPassword])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error('Failed to load events')
      setAllEvents((await res.json()) as MapEvent[])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

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

  // Pin-drag state — refs so the map.on('load') callback (mounted once) always
  // sees the live values without needing to be re-registered.
  const draggingRef = useRef<{ id: string; didMove: boolean } | null>(null)
  const suppressClickRef = useRef(false)

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return

    mapboxgl.accessToken = token

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/standard',
      projection: 'globe',
      // Fallback framing until the festival-stage bounds are fit below (once events load).
      zoom: 13,
      center: [-1.637, 52.8],
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

      if (!m.hasImage('pin-mainstage')) {
        m.addImage('pin-mainstage', createStarIcon(), { pixelRatio: 2 })
      }
      if (!m.hasImage('pin-aftershock')) {
        m.addImage('pin-aftershock', createDiamondIcon(), { pixelRatio: 2 })
      }

      // ── GeoJSON source with clustering ──────────────────────────────────
      m.addSource('events', {
        type: 'geojson',
        data: toGeoJSON(filteredEventsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        // Default maxzoom (18) is lower than the zoom the festival-stage
        // fitBounds already lands on — past it Mapbox overzooms the last
        // generated tile instead of retiling, and pins near that tile's edge
        // fall outside its buffer and vanish. Push it past any zoom we use.
        maxzoom: 22,
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
          'circle-emissive-strength': 1,
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

      // Soft glow behind individual points, tinted to match each category
      m.addLayer({
        id: 'unclustered-point-glow',
        type: 'circle',
        source: 'events',
        slot: 'top',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 11,
          'circle-color': [
            'match',
            ['get', 'category'],
            'mainstage',
            '#FFC53D',
            'aftershock',
            '#A855F7',
            '#2DD4BF',
          ],
          'circle-opacity': 0.18,
          'circle-blur': 1,
          'circle-emissive-strength': 1,
        },
      })

      // Independent events (Skiddle-ingested or community-submitted alike)
      // get a plain teal circle — see the map legend for what each pin means.
      m.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'events',
        slot: 'top',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'category'], 'independent']],
        paint: {
          'circle-radius': 6,
          'circle-color': '#2DD4BF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#0f766e',
          'circle-emissive-strength': 1,
        },
      })

      // The Sonic Boom mainstage gets a gold star pin
      m.addLayer({
        id: 'unclustered-point-mainstage',
        type: 'symbol',
        source: 'events',
        slot: 'top',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'category'], 'mainstage']],
        layout: { 'icon-image': 'pin-mainstage', 'icon-size': 1.3, 'icon-allow-overlap': true },
        paint: { 'icon-emissive-strength': 1 },
      })

      // The remaining festival stages ("aftershocks") get a purple diamond pin
      m.addLayer({
        id: 'unclustered-point-aftershock',
        type: 'symbol',
        source: 'events',
        slot: 'top',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'category'], 'aftershock']],
        layout: { 'icon-image': 'pin-aftershock', 'icon-size': 1.15, 'icon-allow-overlap': true },
        paint: { 'icon-emissive-strength': 1 },
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
      const handlePointClick = (e: mapboxgl.MapMouseEvent) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
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
          source: props.source as MapEvent['source'],
          ticketLink: props.ticketLink ?? undefined,
          websiteLink: props.websiteLink ?? undefined,
          lineup: props.lineup ? (JSON.parse(props.lineup) as LineupEntry[]) : undefined,
        })
      }
      const pointLayers = [
        'unclustered-point',
        'unclustered-point-mainstage',
        'unclustered-point-aftershock',
      ] as const
      pointLayers.forEach((layer) => m.on('click', layer, handlePointClick))

      // ── Cursor: pointer on interactive layers ───────────────────────────
      ;(['clusters', ...pointLayers] as const).forEach((layer) => {
        m.on('mouseenter', layer, () => {
          m.getCanvas().style.cursor = adminPasswordRef.current ? 'grab' : 'pointer'
        })
        m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
      })

      // ── Drag: admin repositions a pin (disabled in read-only embeds) ────
      if (!readOnly) {
        pointLayers.forEach((layer) => {
          m.on('mousedown', layer, (e) => {
            if (!adminPasswordRef.current) return
            const props = e.features?.[0]?.properties
            if (!props) return
            e.preventDefault()
            draggingRef.current = { id: props.id, didMove: false }
            m.dragPan.disable()
            m.getCanvas().style.cursor = 'grabbing'
          })
        })

        m.on('mousemove', (e) => {
          const drag = draggingRef.current
          if (!drag) return
          drag.didMove = true
          const { lng, lat } = e.lngLat
          const updated = filteredEventsRef.current.map((ev) =>
            ev.id === drag.id ? { ...ev, lat, lng } : ev,
          )
          ;(m.getSource('events') as mapboxgl.GeoJSONSource | undefined)?.setData(toGeoJSON(updated))
        })

        const endDrag = async (e: mapboxgl.MapMouseEvent) => {
          const drag = draggingRef.current
          if (!drag) return
          draggingRef.current = null
          m.dragPan.enable()
          m.getCanvas().style.cursor = adminPasswordRef.current ? 'grab' : ''
          if (!drag.didMove) return
          suppressClickRef.current = true

          const original = filteredEventsRef.current.find((ev) => ev.id === drag.id)
          const pw = adminPasswordRef.current
          if (!original || !pw) return
          const { lng, lat } = e.lngLat

          setAllEvents((prev) =>
            prev.map((ev) => (ev.id === drag.id ? { ...ev, lat, lng } : ev)),
          )

          try {
            const res = await fetch(`/api/admin/events/${drag.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'X-Admin-Password': pw },
              body: JSON.stringify({
                name: original.name,
                venue: original.venue,
                city: original.city,
                country: original.country,
                genre: original.genre,
                date: original.date,
                lat,
                lng,
                ticketLink: original.ticketLink,
                websiteLink: original.websiteLink,
                lineup: original.lineup,
              }),
            })
            if (res.status === 401) {
              localStorage.removeItem(ADMIN_PASSWORD_KEY)
              setAdminPassword(null)
            }
            if (!res.ok) {
              setAllEvents((prev) => prev.map((ev) => (ev.id === drag.id ? original : ev)))
            }
          } catch {
            setAllEvents((prev) => prev.map((ev) => (ev.id === drag.id ? original : ev)))
          }
        }
        m.on('mouseup', endDrag)
      }

      // ── Click: empty map → add-event modal (admins only; disabled in read-only embeds) ──
      if (!readOnly) {
        m.on('click', (e) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          if (!adminPasswordRef.current) return
          const hit = m.queryRenderedFeatures(e.point, {
            layers: ['clusters', ...pointLayers],
          })
          if (hit.length === 0) {
            setPendingLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          }
        })
      }

      setMapReady(true)
    })

    return () => {
      map.current?.remove()
    }
  }, [token, readOnly])

  // ── Sync filtered events → GeoJSON source ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !map.current) return
    ;(map.current.getSource('events') as mapboxgl.GeoJSONSource | undefined)?.setData(
      toGeoJSON(filteredEvents),
    )
  }, [filteredEvents, mapReady])

  // ── Auto-open the Mainstage event on first load ─────────────────────────
  // Skipped in readOnly (embed) mode — the embed is just the map + legend.
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (readOnly || autoSelectedRef.current || !mapReady || allEvents.length === 0) return
    const mainstage = allEvents.find((e) => e.id === MAINSTAGE_ID)
    if (mainstage) {
      setSelectedEvent(mainstage)
      autoSelectedRef.current = true
    }
  }, [mapReady, allEvents])

  // ── Frame the initial camera around every festival stage ────────────────
  const boundsFitRef = useRef(false)
  useEffect(() => {
    if (boundsFitRef.current || !mapReady || !map.current || allEvents.length === 0) return
    const stages = allEvents.filter((e) => FESTIVAL_STAGE_IDS.includes(e.id))
    if (stages.length === 0) return
    const bounds = stages.reduce(
      (b, e) => b.extend([e.lng, e.lat] as [number, number]),
      new mapboxgl.LngLatBounds([stages[0].lng, stages[0].lat], [stages[0].lng, stages[0].lat]),
    )
    map.current.fitBounds(bounds, { padding: 80, duration: 0 })
    boundsFitRef.current = true
  }, [mapReady, allEvents, FESTIVAL_STAGE_IDS])

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

  // ── Save new/edited event (admin only) ──────────────────────────────────
  const handleEventSaved = useCallback((event: MapEvent) => {
    setAllEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id)
      return exists ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event]
    })
    setPendingLocation(null)
    setPendingLocationPrefill(null)
    setPendingEdit(null)
  }, [])

  const handleAdminDeleteEvent = useCallback(async (id: string) => {
    const pw = adminPasswordRef.current
    if (!pw) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': pw },
      })
      if (res.status === 401) {
        localStorage.removeItem(ADMIN_PASSWORD_KEY)
        setAdminPassword(null)
        return
      }
      if (!res.ok) throw new Error('Failed to delete event')
      setAllEvents((prev) => prev.filter((e) => e.id !== id))
      setSelectedEvent(null)
    } catch {
      // Leave the panel open and the event in place; admin can retry.
    }
  }, [setAdminPassword])

  const venueKey = (e: MapEvent) =>
    `${e.venue.toLowerCase().trim()}|${e.city.toLowerCase().trim()}`

  const selectedStack = useMemo(() => {
    if (!selectedEvent) return []
    const k = venueKey(selectedEvent)
    return [...filteredEvents]
      .filter((e) => venueKey(e) === k)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [selectedEvent, filteredEvents])

  const stackIndex = selectedStack.findIndex((e) => e.id === selectedEvent?.id)

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
      {/* Top bar (filters/search/embed) temporarily hidden — re-enable by uncommenting. */}
      {false && !readOnly && (
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
              <>
                <Search
                  token={token}
                  onFlyTo={(center) => map.current?.flyTo({ center, zoom: 14 })}
                />
                <EmbedButton />
              </>
            }
          />

          <InfoPanel />
        </>
      )}

      <Legend />

      {!readOnly && adminPassword && (
        <div className="fixed top-4 right-4 z-30 flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded-lg shadow-lg">
          Admin mode
          <button
            onClick={() => {
              localStorage.removeItem(ADMIN_PASSWORD_KEY)
              setAdminPassword(null)
            }}
            className="text-zinc-400 hover:text-white underline transition-colors"
          >
            Log out
          </button>
        </div>
      )}

      {loading && allEvents.length === 0 && !loadError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-zinc-900/90 text-zinc-300 text-sm px-4 py-2 rounded-lg shadow-lg">
          Loading events…
        </div>
      )}

      {loadError && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-red-900/90 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          Couldn&apos;t load events.
          <button onClick={loadEvents} className="underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      <div ref={mapContainer} style={{ width: '100vw', height: '100vh' }} />

      {!readOnly && adminPassword && pendingLocation && (
        <AddEventModal
          lat={pendingLocation.lat}
          lng={pendingLocation.lng}
          token={token}
          onSaved={handleEventSaved}
          onClose={() => { setPendingLocation(null); setPendingLocationPrefill(null) }}
          prefillVenue={pendingLocationPrefill ?? undefined}
          adminPassword={adminPassword}
        />
      )}

      {!readOnly && adminPassword && pendingEdit && (
        <AddEventModal
          lat={pendingEdit.lat}
          lng={pendingEdit.lng}
          token={token}
          onSaved={handleEventSaved}
          onClose={() => setPendingEdit(null)}
          initialEvent={pendingEdit}
          adminPassword={adminPassword}
        />
      )}

      {!readOnly && selectedEvent && (
        <div
          ref={panelRef}
          className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-700 px-6 pt-5 pb-8 animate-slide-up overflow-y-auto"
          style={{ maxHeight: '50vh' }}
        >
          <div className="max-w-2xl mx-auto">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 pr-4">
                <h2 className="text-white text-xl font-semibold leading-tight">
                  {selectedEvent.name}
                </h2>
                {/* 'your event' label temporarily hidden — re-enable by uncommenting. */}
                {selectedEvent.source === 'user' && false && (
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
                {!readOnly && Boolean(adminPassword) && (
                  <>
                    <button
                      onClick={() => { setPendingEdit(selectedEvent); setSelectedEvent(null) }}
                      className="text-xs px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleAdminDeleteEvent(selectedEvent.id)}
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

            {selectedStack.length > 1 && (
              <div className="flex items-center gap-3 mb-3 text-xs text-zinc-500">
                <button
                  onClick={() => setSelectedEvent(selectedStack[stackIndex - 1])}
                  disabled={stackIndex === 0}
                  className="hover:text-white transition-colors disabled:opacity-25"
                  aria-label="Previous event"
                >
                  ‹
                </button>
                <span>{stackIndex + 1} / {selectedStack.length} events at this venue</span>
                <button
                  onClick={() => setSelectedEvent(selectedStack[stackIndex + 1])}
                  disabled={stackIndex === selectedStack.length - 1}
                  className="hover:text-white transition-colors disabled:opacity-25"
                  aria-label="Next event"
                >
                  ›
                </button>
              </div>
            )}

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

            {!readOnly && Boolean(adminPassword) && (
              <div className="mt-4 pt-3 border-t border-zinc-800">
                <button
                  onClick={() => {
                    setPendingLocationPrefill({
                      venue: selectedEvent.venue,
                      city: selectedEvent.city,
                      country: selectedEvent.country,
                    })
                    setPendingLocation({ lat: selectedEvent.lat, lng: selectedEvent.lng })
                    setSelectedEvent(null)
                  }}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                >
                  + Add another event at this venue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
