'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import type { DeliveryRadiusTier } from '@/lib/app-settings-schema'

const ZONE_COLORS = [
  '#8B5A2B',
  '#C4783A',
  '#D4AF37',
  '#6B8F71',
  '#5B7C99',
  '#9B6B8A',
]

type Props = {
  latitude: number
  longitude: number
  tiers: DeliveryRadiusTier[]
  onStorePinChange: (lat: number, lng: number) => void
}

declare global {
  interface Window {
    google: any
  }
}

/**
 * Admin map: store pin + radius rings for delivery zones.
 * Click / drag the pin to reposition the store.
 */
export function DeliveryZonesMap({
  latitude,
  longitude,
  tiers,
  onStorePinChange,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circlesRef = useRef<any[]>([])
  const [status, setStatus] = useState('Loading map…')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setStatus('Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to preview zones on a map.')
        return
      }
      if (!mapRef.current) return

      try {
        const loader = new Loader({
          apiKey,
          version: 'weekly',
          libraries: ['places'],
        })
        await loader.load()
        if (cancelled || !mapRef.current) return

        const center = {
          lat: Number.isFinite(latitude) ? latitude : 27.7172,
          lng: Number.isFinite(longitude) ? longitude : 85.324,
        }

        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapInstance.current = map

        const marker = new window.google.maps.Marker({
          map,
          position: center,
          draggable: true,
          title: 'Store location',
        })
        markerRef.current = marker

        const emit = (lat: number, lng: number) => {
          onStorePinChange(
            Math.round(lat * 1_000_000) / 1_000_000,
            Math.round(lng * 1_000_000) / 1_000_000
          )
        }

        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (!pos) return
          emit(pos.lat(), pos.lng())
        })

        map.addListener('click', (event: any) => {
          const lat = event.latLng?.lat()
          const lng = event.latLng?.lng()
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
          marker.setPosition({ lat, lng })
          emit(lat, lng)
        })

        setReady(true)
        setStatus('')
      } catch (error) {
        console.error('Delivery zones map failed:', error)
        if (!cancelled) setStatus('Could not load Google Maps.')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
    // Intentionally mount once; pin/tiers sync via separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !mapInstance.current || !markerRef.current) return
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    const pos = { lat: latitude, lng: longitude }
    markerRef.current.setPosition(pos)
    mapInstance.current.panTo(pos)
  }, [latitude, longitude, ready])

  useEffect(() => {
    if (!ready || !mapInstance.current || !window.google?.maps) return

    for (const circle of circlesRef.current) {
      circle.setMap(null)
    }
    circlesRef.current = []

    const center = {
      lat: Number.isFinite(latitude) ? latitude : 27.7172,
      lng: Number.isFinite(longitude) ? longitude : 85.324,
    }

    const sorted = [...tiers].sort((a, b) => b.maxRadiusKm - a.maxRadiusKm)
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i]
      const color = ZONE_COLORS[i % ZONE_COLORS.length]
      const circle = new window.google.maps.Circle({
        map: mapInstance.current,
        center,
        radius: tier.maxRadiusKm * 1000,
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.12,
        clickable: false,
      })
      circlesRef.current.push(circle)
    }

    if (sorted.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      const maxKm = sorted[0].maxRadiusKm
      const pad = maxKm / 111
      bounds.extend({ lat: center.lat + pad, lng: center.lng + pad })
      bounds.extend({ lat: center.lat - pad, lng: center.lng - pad })
      mapInstance.current.fitBounds(bounds, 48)
    }
  }, [tiers, latitude, longitude, ready])

  return (
    <div className="overflow-hidden rounded-2xl border border-wine/10 bg-cream/30">
      <div ref={mapRef} className="h-[320px] w-full bg-cream" />
      {status ? (
        <p className="border-t border-wine/10 px-4 py-3 text-sm text-ink/65">
          {status}
        </p>
      ) : (
        <p className="border-t border-wine/10 px-4 py-2 text-xs text-ink/55">
          Click the map or drag the pin to set the store location. Rings show each
          delivery zone.
        </p>
      )}
      {tiers.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-wine/10 px-4 py-3">
          {[...tiers]
            .sort((a, b) => a.maxRadiusKm - b.maxRadiusKm)
            .map((tier, index) => (
              <li
                key={tier.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs text-ink/80"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: ZONE_COLORS[index % ZONE_COLORS.length],
                  }}
                />
                ≤ {tier.maxRadiusKm} km · Rs {tier.feeAmount} ·{' '}
                {tier.etaMinMinutes}-{tier.etaMaxMinutes} min
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
