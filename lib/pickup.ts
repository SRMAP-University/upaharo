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

/** Strip variant cart ids like `productId::v0` down to the product id. */
export function baseProductId(id: string) {
  const raw = String(id || '').trim()
  const sep = raw.indexOf('::')
  return sep > 0 ? raw.slice(0, sep) : raw
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
 * Among products that individually support pickup, pick the largest set that
 * shares one pin (used for mixed carts: pickup some + deliver the rest).
 */
export function resolveLargestSharedPickupGroup(products: PickupProductFields[]): {
  location: PickupLocation | null
  productIds: string[]
} {
  const capable = products
    .map((product) => ({ id: product.id, location: pickupLocationOf(product) }))
    .filter((row): row is { id: string; location: PickupLocation } => row.location != null)

  if (capable.length === 0) return { location: null, productIds: [] }

  const groups = new Map<string, { location: PickupLocation; productIds: string[] }>()
  for (const row of capable) {
    const key = `${row.location.latitude.toFixed(5)},${row.location.longitude.toFixed(5)}`
    const existing = groups.get(key)
    if (existing) {
      existing.productIds.push(row.id)
    } else {
      groups.set(key, { location: row.location, productIds: [row.id] })
    }
  }

  let best: { location: PickupLocation | null; productIds: string[] } = {
    location: null,
    productIds: [],
  }
  for (const group of groups.values()) {
    if (group.productIds.length > best.productIds.length) {
      best = group
    }
  }
  return best
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
  const uniqueIds = Array.from(
    new Set(ids.map((id) => baseProductId(id)).filter(Boolean))
  )
  const products = await loadPickupProducts(uniqueIds)
  const group = resolveLargestSharedPickupGroup(products)

  // Whole cart is pickup-eligible only when every requested id is found and
  // shares one pin. Otherwise clients may still split: pickup the group, deliver the rest.
  const eligible =
    products.length === uniqueIds.length &&
    group.location != null &&
    group.productIds.length === uniqueIds.length

  return {
    eligible,
    location: group.location,
    pickupProductIds: group.productIds,
  }
}
