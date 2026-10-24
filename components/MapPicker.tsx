'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

type ParsedFields = {
  street?: string
  area?: string
  landmark?: string
  city?: string
  state?: string
  pincode?: string
}

type SearchResult = {
  address: string
  lat: number
  lng: number
  parsed: ParsedFields
}

interface MapPickerProps {
  onLocationSelect: (
    lat: number,
    lng: number,
    address: string,
    parsed?: ParsedFields
  ) => void
  initialLat?: number
  initialLng?: number
}

declare global {
  interface Window {
    google: any
  }
}

const DEFAULT_CENTER = { lat: 27.7172, lng: 85.324 }

function zoomForAccuracy(accuracy: number) {
  if (accuracy < 20) return 19
  if (accuracy < 100) return 18
  if (accuracy < 500) return 17
  return 16
}

/** Roughly 3 m — smaller moves do not need a new address lookup. */
function samePoint(a: { lat: number; lng: number } | null, b: { lat: number; lng: number }) {
  return Boolean(a && Math.abs(a.lat - b.lat) < 0.00003 && Math.abs(a.lng - b.lng) < 0.00003)
}

export default function MapPicker({ onLocationSelect, initialLat, initialLng }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const lookupIdRef = useRef(0)
  const lastLookupRef = useRef<{ lat: number; lng: number } | null>(null)
  const mapInitialized = useRef(false)
  const skipNextSearchRef = useRef(false)
  const [map, setMap] = useState<any | null>(null)
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [isLocating, setIsLocating] = useState(false)
  const [locateError, setLocateError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const lookupId = ++lookupIdRef.current
      lastLookupRef.current = { lat, lng }
      onLocationSelect(lat, lng, 'Resolving exact address...')

      try {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), 10000)
        const response = await fetch(
          `/api/location/reverse-geocode?lat=${lat}&lng=${lng}`,
          { cache: 'no-store', signal: controller.signal }
        )
        window.clearTimeout(timeoutId)

        if (lookupId !== lookupIdRef.current) return

        if (!response.ok) {
          onLocationSelect(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
          return
        }

        const data = await response.json()
        if (lookupId !== lookupIdRef.current) return

        onLocationSelect(
          lat,
          lng,
          data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          data.parsed
        )
      } catch (error) {
        if (lookupId !== lookupIdRef.current) return
        console.warn('Reverse geocoding failed:', error)
        onLocationSelect(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`)
      }
    },
    [onLocationSelect]
  )

  const locateUser = useCallback(
    (mapInstance: any) => {
      if (!('geolocation' in navigator)) {
        setLocateError('Location is not supported on this device')
        return
      }
      setIsLocating(true)
      setLocateError('')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false)
          const next = { lat: position.coords.latitude, lng: position.coords.longitude }
          mapInstance.panTo(next)
          mapInstance.setZoom(zoomForAccuracy(position.coords.accuracy))
        },
        (error) => {
          console.warn('Geolocation failed:', error.message)
          setIsLocating(false)
          setLocateError('Couldn’t get your location — move the map or search instead')
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      )
    },
    []
  )

  // Show the map straight away, then move to the phone's location when it arrives.
  useEffect(() => {
    if (mapInitialized.current) return
    mapInitialized.current = true

    const loadMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        console.error('Google Maps API key not found')
        setMapState('unavailable')
        return
      }

      const hasSaved = initialLat !== undefined && initialLng !== undefined && (initialLat !== 0 || initialLng !== 0)
      let center = hasSaved ? { lat: initialLat as number, lng: initialLng as number } : DEFAULT_CENTER

      if (!hasSaved) {
        try {
          const response = await fetch('/api/settings', { cache: 'no-store' })
          if (response.ok) {
            const settings = await response.json()
            const lat = Number(settings.mapLatitude)
            const lng = Number(settings.mapLongitude)
            if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
              center = { lat, lng }
            }
          }
        } catch (error) {
          console.error('Failed to load map defaults:', error)
        }
      }

      try {
        await new Loader({ apiKey, version: 'weekly' }).load()
      } catch (error) {
        console.error('Error loading Google Maps:', error)
        setMapState('unavailable')
        return
      }
      if (!mapRef.current) return

      const google = window.google
      const mapInstance = new google.maps.Map(mapRef.current, {
        center,
        zoom: hasSaved ? 18 : 15,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      })

      mapInstance.addListener('dragstart', () => {
        setIsDragging(true)
        setHasMoved(true)
      })
      mapInstance.addListener('click', (e: any) => {
        if (e.latLng) {
          setHasMoved(true)
          mapInstance.panTo(e.latLng)
        }
      })
      // The pin sits at the map centre; look up the address once the map settles.
      mapInstance.addListener('idle', () => {
        setIsDragging(false)
        const c = mapInstance.getCenter()
        if (!c) return
        const point = { lat: c.lat(), lng: c.lng() }
        if (samePoint(lastLookupRef.current, point)) return
        void reverseGeocode(point.lat, point.lng)
      })

      setMap(mapInstance)
      setMapState('ready')
      if (!hasSaved) locateUser(mapInstance)
    }

    void loadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng])

  // Place search (debounced)
  useEffect(() => {
    const q = searchQuery.trim()
    // Filling the box with a picked result should not search again.
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }
    if (q.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timer = window.setTimeout(async () => {
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller

      try {
        const response = await fetch(
          `/api/location/search?q=${encodeURIComponent(q)}`,
          { cache: 'no-store', signal: controller.signal }
        )
        if (!response.ok) {
          setSearchResults([])
          return
        }
        const data = await response.json()
        setSearchResults(Array.isArray(data.results) ? data.results : [])
        setShowResults(true)
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.warn('Place search failed:', error)
          setSearchResults([])
        }
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const selectSearchResult = (place: SearchResult) => {
    skipNextSearchRef.current = true
    setSearchQuery(place.address)
    setShowResults(false)
    setSearchResults([])
    setHasMoved(true)
    setLocateError('')

    // Show the search result's address now; the map's idle lookup refines it.
    lastLookupRef.current = null
    onLocationSelect(place.lat, place.lng, place.address, place.parsed)
    if (map) {
      map.panTo({ lat: place.lat, lng: place.lng })
      map.setZoom(18)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-cream-deep">
      <div ref={mapRef} className="h-full w-full" />

      {mapState === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-cream-deep">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-wine/15 border-t-wine" />
        </div>
      ) : null}

      {mapState === 'unavailable' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cream-deep px-8 text-center">
          <svg className="h-10 w-10 text-wine/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <p className="mt-3 text-sm font-semibold text-ink">The map couldn’t load</p>
          <p className="mt-1 text-xs text-ink/55">Search for your area above instead.</p>
        </div>
      ) : null}

      {mapState === 'ready' ? (
        <>
          {/* Fixed centre pin: the map moves under it */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
            {!hasMoved ? (
              <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-xs font-medium text-white shadow-lg">
                Move the map to set your delivery point
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-ink" />
              </div>
            ) : null}
            <div className={`transition-transform duration-150 ${isDragging ? '-translate-y-2' : ''}`}>
              <svg width="40" height="48" viewBox="0 0 40 48" aria-hidden>
                <path d="M20 47s16-15.2 16-27A16 16 0 004 20c0 11.8 16 27 16 27z" fill="#7c2a47" />
                <circle cx="20" cy="20" r="6.5" fill="#fff" />
              </svg>
            </div>
          </div>
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 z-[5] h-1.5 -translate-x-1/2 rounded-full bg-ink/25 blur-[1px] transition-all duration-150 ${
              isDragging ? 'w-5 opacity-60' : 'w-3 opacity-100'
            }`}
          />

          <button
            type="button"
            onClick={() => map && locateUser(map)}
            className="absolute bottom-4 right-4 z-10 flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-wine shadow-[0_8px_24px_-10px_rgba(43,29,34,0.5)] transition hover:bg-cream"
          >
            {isLocating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-wine/20 border-t-wine" />
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="3.5" strokeWidth={2} />
                <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m0 14v3M2 12h3m14 0h3" />
              </svg>
            )}
            {isLocating ? 'Locating…' : 'Use my location'}
          </button>
        </>
      ) : null}

      {/* Search */}
      <div className="absolute left-3 right-3 top-3 z-20">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_8px_28px_-12px_rgba(43,29,34,0.45)]">
          <div className="flex items-center gap-3 px-4 py-3">
            <svg className="h-5 w-5 shrink-0 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowResults(true)
              }}
              onBlur={() => {
                // Delay so result clicks register
                window.setTimeout(() => setShowResults(false), 180)
              }}
              placeholder="Search area, street or landmark"
              className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/40"
              autoComplete="off"
              enterKeyHint="search"
            />
            {isSearching ? (
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-wine/20 border-t-wine" />
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSearchResults([])
                }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-deep text-ink/50"
                aria-label="Clear search"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>

          {showResults && (searchResults.length > 0 || (searchQuery.trim().length >= 2 && !isSearching)) ? (
            <ul className="max-h-60 overflow-y-auto border-t border-ink/10">
              {searchResults.length === 0 ? (
                <li className="px-4 py-3 text-sm text-ink/50">No places found</li>
              ) : (
                searchResults.map((place) => {
                  const [first, ...rest] = place.address.split(',')
                  return (
                    <li key={`${place.lat}-${place.lng}-${place.address}`}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-cream"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSearchResult(place)}
                      >
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-ink/35" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" />
                        </svg>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">{first}</span>
                          {rest.length > 0 ? (
                            <span className="block truncate text-xs text-ink/50">{rest.join(',').trim()}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          ) : null}
        </div>

        {isLocating || locateError ? (
          <div className="mt-2 flex justify-center">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-ink/70 shadow-sm">
              {isLocating ? 'Finding your location…' : locateError}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
