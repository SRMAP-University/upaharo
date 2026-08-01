/**
 * Delivery zone matching — polygon zones preferred; circle tiers as fallback.
 * Pure helpers — safe for client and server.
 */

import {
  formatRadiusEta,
  type DeliveryRadiusTier,
  type DeliveryZone,
  type DeliveryZonePoint,
} from '@/lib/app-settings-schema'
import { calculateDistance } from '@/lib/utils'

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export type DeliveryZoneMatch =
  | {
      inRange: true
      tier: DeliveryRadiusTier | null
      zone: DeliveryZone | null
      distanceKm: number
      feeAmount: number
      estimate: string
      etaMinMinutes: number
      etaMaxMinutes: number
      label: string
    }
  | {
      inRange: false
      distanceKm: number
      maxRadiusKm: number
      feeAmount: null
      estimate: null
    }

/** Haversine distance in kilometres. */
export function distanceKmBetween(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistance(lat1, lon1, lat2, lon2) / 1000
}

/** Ray-casting point-in-polygon (lat/lng treated as planar for local zones). */
export function pointInPolygon(
  point: DeliveryZonePoint,
  polygon: DeliveryZonePoint[]
): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Approximate polygon area in deg² (relative only — for smallest-zone pick). */
export function polygonAreaDeg2(polygon: DeliveryZonePoint[]): number {
  if (polygon.length < 3) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    sum += polygon[j].lng * polygon[i].lat - polygon[i].lng * polygon[j].lat
  }
  return Math.abs(sum) / 2
}

export function matchDeliveryPolygonZone(
  zones: DeliveryZone[],
  lat: number,
  lng: number
): DeliveryZone | null {
  if (!zones.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const point = { lat, lng }
  let best: DeliveryZone | null = null
  let bestArea = Number.POSITIVE_INFINITY
  for (const zone of zones) {
    if (!pointInPolygon(point, zone.polygon)) continue
    const area = polygonAreaDeg2(zone.polygon)
    if (area < bestArea) {
      bestArea = area
      best = zone
    }
  }
  return best
}

/** First tier whose maxRadiusKm covers [distanceKm], or null if outside all zones. */
export function matchDeliveryRadiusTier(
  tiers: DeliveryRadiusTier[],
  distanceKm: number
): DeliveryRadiusTier | null {
  if (!tiers.length || !Number.isFinite(distanceKm) || distanceKm < 0) return null
  for (const tier of tiers) {
    if (distanceKm <= tier.maxRadiusKm + 1e-9) return tier
  }
  return null
}

export function maxDeliveryRadiusKm(tiers: DeliveryRadiusTier[]): number {
  if (!tiers.length) return 0
  return Math.max(...tiers.map((tier) => tier.maxRadiusKm))
}

/** Circle-tier matching (legacy). */
export function resolveDeliveryZone(params: {
  tiers: DeliveryRadiusTier[]
  storeLat: number
  storeLng: number
  addressLat: number
  addressLng: number
}): DeliveryZoneMatch | null {
  return resolveDeliveryCoverage({
    zones: [],
    tiers: params.tiers,
    storeLat: params.storeLat,
    storeLng: params.storeLng,
    addressLat: params.addressLat,
    addressLng: params.addressLng,
  })
}

/**
 * Prefer polygon zones when present; otherwise fall back to circle tiers.
 * Returns null when neither is configured.
 */
export function resolveDeliveryCoverage(params: {
  zones?: DeliveryZone[] | null
  tiers?: DeliveryRadiusTier[] | null
  storeLat: number
  storeLng: number
  addressLat: number
  addressLng: number
}): DeliveryZoneMatch | null {
  const zones = params.zones ?? []
  const tiers = params.tiers ?? []
  const { storeLat, storeLng, addressLat, addressLng } = params

  if (
    !Number.isFinite(storeLat) ||
    !Number.isFinite(storeLng) ||
    !Number.isFinite(addressLat) ||
    !Number.isFinite(addressLng)
  ) {
    return null
  }

  const distanceKm = distanceKmBetween(storeLat, storeLng, addressLat, addressLng)

  if (zones.length > 0) {
    const zone = matchDeliveryPolygonZone(zones, addressLat, addressLng)
    if (!zone) {
      return {
        inRange: false,
        distanceKm,
        maxRadiusKm: 0,
        feeAmount: null,
        estimate: null,
      }
    }
    return {
      inRange: true,
      tier: null,
      zone,
      distanceKm,
      feeAmount: roundMoney(zone.feeAmount),
      estimate: formatRadiusEta(zone.etaMinMinutes, zone.etaMaxMinutes),
      etaMinMinutes: zone.etaMinMinutes,
      etaMaxMinutes: zone.etaMaxMinutes,
      label: zone.label,
    }
  }

  if (!tiers.length) return null

  const tier = matchDeliveryRadiusTier(tiers, distanceKm)
  const maxRadiusKm = maxDeliveryRadiusKm(tiers)

  if (!tier) {
    return {
      inRange: false,
      distanceKm,
      maxRadiusKm,
      feeAmount: null,
      estimate: null,
    }
  }

  return {
    inRange: true,
    tier,
    zone: null,
    distanceKm,
    feeAmount: roundMoney(tier.feeAmount),
    estimate: formatRadiusEta(tier.etaMinMinutes, tier.etaMaxMinutes),
    etaMinMinutes: tier.etaMinMinutes,
    etaMaxMinutes: tier.etaMaxMinutes,
    label: tier.label,
  }
}
