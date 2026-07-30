/**
 * Distance-based delivery zones (fee + ETA) from the store map pin.
 * Pure helpers — safe for client and server.
 */

import {
  formatRadiusEta,
  type DeliveryRadiusTier,
} from '@/lib/app-settings-schema'
import { calculateDistance } from '@/lib/utils'

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export type DeliveryZoneMatch =
  | {
      inRange: true
      tier: DeliveryRadiusTier
      distanceKm: number
      feeAmount: number
      estimate: string
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

export function resolveDeliveryZone(params: {
  tiers: DeliveryRadiusTier[]
  storeLat: number
  storeLng: number
  addressLat: number
  addressLng: number
}): DeliveryZoneMatch | null {
  const { tiers, storeLat, storeLng, addressLat, addressLng } = params
  if (!tiers.length) return null
  if (
    !Number.isFinite(storeLat) ||
    !Number.isFinite(storeLng) ||
    !Number.isFinite(addressLat) ||
    !Number.isFinite(addressLng)
  ) {
    return null
  }

  const distanceKm = distanceKmBetween(storeLat, storeLng, addressLat, addressLng)
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
    distanceKm,
    feeAmount: roundMoney(tier.feeAmount),
    estimate: formatRadiusEta(tier.etaMinMinutes, tier.etaMaxMinutes),
  }
}
