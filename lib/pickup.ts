import { prisma } from '@/lib/prisma'
import { isMissingPickupColumnError, PICKUP_PRODUCT_SELECT } from '@/lib/product-db'

export type PickupLocation = {
  latitude: number
  longitude: number
  address: string | null
}

export type PickupProductFields = {
  id: string
  name?: string
  pickupEnabled?: boolean | null
  pickupLatitude?: number | null
  pickupLongitude?: number | null
  pickupAddress?: string | null
}

/** ~1m at Kathmandu latitude; pins saved from the same map should match. */
const COORD_TOLERANCE = 1e-5

export function samePickupPoint(a: PickupLocation, b: PickupLocation) {
  return (
    Math.abs(a.latitude - b.latitude) <= COORD_TOLERANCE &&
    Math.abs(a.longitude - b.longitude) <= COORD_TOLERANCE
  )
}

export function pickupLocationOf(product: PickupProductFields): PickupLocation | null {
  if (!product?.pickupEnabled) return null

  const latitude = Number(product.pickupLatitude)
  const longitude = Number(product.pickupLongitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null

  const address = typeof product.pickupAddress === 'string' ? product.pickupAddress.trim() : ''

  return { latitude, longitude, address: address || null }
}

/**
 * Pickup is offered only when every item can be collected from the exact same
 * pin, so an order never has to be split across two locations.
 */
export function resolveSharedPickupLocation(
  products: PickupProductFields[]
): PickupLocation | null {
  if (products.length === 0) return null

  let shared: PickupLocation | null = null

  for (const product of products) {
    const location = pickupLocationOf(product)
    if (!location) return null

    if (!shared) {
      shared = location
    } else if (!samePickupPoint(shared, location)) {
      return null
    }
  }

  return shared
}

/**
 * Normalizes the admin product form payload. Disabling pickup clears the pin so
 * a stale location can never be matched at checkout.
 */
export function normalizePickupInput(body: Record<string, unknown>):
  | { ok: true; data: { pickupEnabled: boolean; pickupLatitude: number | null; pickupLongitude: number | null; pickupAddress: string | null } }
  | { ok: false; error: string } {
  const pickupEnabled = body?.pickupEnabled === true

  if (!pickupEnabled) {
    return {
      ok: true,
      data: {
        pickupEnabled: false,
        pickupLatitude: null,
        pickupLongitude: null,
        pickupAddress: null,
      },
    }
  }

  const latitude = Number(body?.pickupLatitude)
  const longitude = Number(body?.pickupLongitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, error: 'A pickup location is required when pickup is enabled' }
  }

  const address = String(body?.pickupAddress || '').trim()

  return {
    ok: true,
    data: {
      pickupEnabled: true,
      pickupLatitude: latitude,
      pickupLongitude: longitude,
      pickupAddress: address || null,
    },
  }
}

/** Returns an empty list when the DB predates the pickup columns. */
export async function loadPickupProducts(ids: string[]): Promise<PickupProductFields[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)))
  if (uniqueIds.length === 0) return []

  try {
    return await prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: PICKUP_PRODUCT_SELECT,
    })
  } catch (error) {
    if (isMissingPickupColumnError(error)) return []
    throw error
  }
}

export async function resolvePickupForProductIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)))
  const products = await loadPickupProducts(uniqueIds)

  if (products.length !== uniqueIds.length) {
    return { eligible: false as const, location: null }
  }

  const location = resolveSharedPickupLocation(products)

  return { eligible: Boolean(location), location }
}
