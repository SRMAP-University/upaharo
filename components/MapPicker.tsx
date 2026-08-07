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

export default function MapPicker({ onLocationSelect, initialLat, initialLng }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const lookupIdRef = useRef(0)
  const [map, setMap] = useState<any | null>(null)
  const [marker, setMarker] = useState<any | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(
    null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [locationStatus, setLocationStatus] = useState<string>('Detecting your location...')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const mapInitialized = useRef(false)

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      const lookupId = ++lookupIdRef.current
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

  // Auto-detect user location on mount
  useEffect(() => {
    if (mapInitialized.current) return
    mapInitialized.current = true

    const loadMap = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

      if (!apiKey) {
        console.error('Google Maps API key not found')
        setIsLoading(false)
        setLocationStatus('Map unavailable')
        return
      }

      let fallbackLat = initialLat ?? 27.7172
      let fallbackLng = initialLng ?? 85.324

      if (initialLat === undefined || initialLng === undefined) {
        try {
          const response = await fetch('/api/settings', { cache: 'no-store' })
          if (response.ok) {
            const settings = await response.json()
            fallbackLat = initialLat ?? Number(settings.mapLatitude ?? fallbackLat)
            fallbackLng = initialLng ?? Number(settings.mapLongitude ?? fallbackLng)
          }
        } catch (error) {
          console.error('Failed to load map defaults:', error)
        }
      }

      const loader = new Loader({
        apiKey,
        version: 'weekly',
      })

      loader
        .load()
        .then(() => {
          if (!mapRef.current) return

          const google = window.google

          if ('geolocation' in navigator) {
            setLocationStatus('Getting your precise delivery location...')

            navigator.geolocation.getCurrentPosition(
              (position) => {
                const userLat = position.coords.latitude
                const userLng = position.coords.longitude
                const accuracy = position.coords.accuracy

                setLocationStatus(`Location found (±${Math.round(accuracy)}m)`)
                initializeMap(google, userLat, userLng, accuracy)
              },
              (error) => {
                console.warn('Geolocation failed:', error.message)
                setLocationStatus('Using store delivery area as default')
                initializeMap(google, fallbackLat, fallbackLng, 1000)
              },
              {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0,
              }
            )
          } else {
            setLocationStatus('Geolocation not supported')
            initializeMap(google, fallbackLat, fallbackLng, 1000)
          }
        })
        .catch((error) => {
          console.error('Error loading Google Maps:', error)
          setIsLoading(false)
          setLocationStatus('Failed to load map')
        })
    }

    void loadMap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLat, initialLng])

  const initializeMap = (google: any, lat: number, lng: number, accuracy: number) => {
    if (!mapRef.current) return

    const zoomLevel =
      accuracy < 20 ? 20 : accuracy < 50 ? 19 : accuracy < 100 ? 18 : accuracy < 300 ? 17 : 16

    const mapInstance = new google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: zoomLevel,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      gestureHandling: 'greedy',
    })

    const markerInstance = new google.maps.Marker({
      position: { lat, lng },
      map: mapInstance,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'Drag to adjust location',
    })

    setMap(mapInstance)
    setMarker(markerInstance)
    setSelectedPosition({ lat, lng })
    setIsLoading(false)

    mapInstance.addListener('click', (e: any) => {
      if (e.latLng) {
        const clickLat = e.latLng.lat()
        const clickLng = e.latLng.lng()
        markerInstance.setPosition(e.latLng)
        setSelectedPosition({ lat: clickLat, lng: clickLng })
        void reverseGeocode(clickLat, clickLng)
      }
    })

    markerInstance.addListener('dragend', () => {
      const position = markerInstance.getPosition()
      if (position) {
        const dragLat = position.lat()
        const dragLng = position.lng()
        setSelectedPosition({ lat: dragLat, lng: dragLng })
        void reverseGeocode(dragLat, dragLng)
      }
    })

    void reverseGeocode(lat, lng)
  }

  // OpenStreetMap Nominatim place search (debounced)
  useEffect(() => {
    const q = searchQuery.trim()
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
    const nextPosition = { lat: place.lat, lng: place.lng }
    setSelectedPosition(nextPosition)
    setSearchQuery(place.address)
    setShowResults(false)
    setSearchResults([])

    if (map) {
      map.panTo(nextPosition)
      map.setZoom(18)
    }
    if (marker) {
      marker.setPosition(nextPosition)
    }

    onLocationSelect(place.lat, place.lng, place.address, place.parsed)
    // Refresh via reverse-geocode (Google → Nominatim) for consistent parsed fields
    void reverseGeocode(place.lat, place.lng)
  }

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      setIsLoading(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const accuracy = position.coords.accuracy
          const newPosition = { lat, lng }

          setSelectedPosition(newPosition)

          if (map) {
            map.setCenter(newPosition)
            const zoomLevel =
              accuracy < 20
                ? 20
                : accuracy < 50
                  ? 19
                  : accuracy < 100
                    ? 18
                    : accuracy < 500
                      ? 17
                      : 16
            map.setZoom(zoomLevel)
          }

          if (marker) {
            marker.setPosition(newPosition)
          }

          void reverseGeocode(lat, lng)
          setIsLoading(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          alert('Unable to get your location. Please enable location services and try again.')
          setIsLoading(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      )
    } else {
      alert('Geolocation is not supported by your browser')
    }
  }

  return (
    <div className="relative w-full h-full min-h-[420px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-cream-deep z-10">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-wine/20 border-t-wine"></div>
            <p className="text-sm text-ink/70 font-medium">{locationStatus}</p>
            <p className="text-xs text-ink/55">Please allow location access for accurate results</p>
          </div>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full" />

      <div className="absolute left-4 right-4 top-4 z-10">
        <div className="rounded-2xl border border-wine/10 bg-white shadow-lg">
          <div className="flex items-center gap-3 px-4 py-3">
            <svg
              className="h-5 w-5 shrink-0 text-wine"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              />
            </svg>
            <input
              ref={searchInputRef}
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
              placeholder="Search location, area or landmark"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
              autoComplete="off"
            />
            {isSearching ? (
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-wine/20 border-t-wine" />
            ) : null}
          </div>

          {showResults && (searchResults.length > 0 || (searchQuery.trim().length >= 2 && !isSearching)) ? (
            <ul className="max-h-56 overflow-y-auto border-t border-wine/10">
              {searchResults.length === 0 ? (
                <li className="px-4 py-3 text-xs text-ink/50">No places found</li>
              ) : (
                searchResults.map((place) => (
                  <li key={`${place.lat}-${place.lng}-${place.address}`}>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-cream-deep"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSearchResult(place)}
                    >
                      <span className="line-clamp-2">{place.address}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>

      <button
        onClick={handleUseCurrentLocation}
        className="absolute bottom-20 right-4 bg-white p-3 rounded-full shadow-lg border border-wine/10 hover:bg-cream-deep transition-colors z-10"
        title="Use my current location"
      >
        <svg className="w-6 h-6 text-wine" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      <div className="absolute bottom-4 left-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-full border border-wine/10 bg-white px-4 py-2 shadow-lg z-10">
        <p className="text-xs text-ink/60 text-center">
          Tap anywhere or drag the pin to set the exact delivery point
        </p>
      </div>
    </div>
  )
}
