import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

export const PRODUCT_UNITS = ['kg', 'g', 'ml', 'l', 'piece', 'pack'] as const
export type ProductUnit = (typeof PRODUCT_UNITS)[number]

export function normalizeSku(input: unknown): string | null {
  const sku = String(input ?? '').trim()
  return sku.length > 0 ? sku.slice(0, 64) : null
}

export function normalizeInventoryFields(body: Record<string, unknown>) {
  const trackStock = body.trackStock === true
  let stockQty: number | null = null

  if (body.stockQty !== undefined && body.stockQty !== null && body.stockQty !== '') {
    const qty = Math.round(Number(body.stockQty))
    if (!Number.isFinite(qty) || qty < 0) {
      return { ok: false as const, error: 'stockQty must be a non-negative integer' }
    }
    stockQty = qty
  } else if (trackStock) {
    stockQty = 0
  }

  const sku = body.sku !== undefined ? normalizeSku(body.sku) : undefined

  return {
    ok: true as const,
    data: {
      ...(sku !== undefined ? { sku } : {}),
      trackStock,
      stockQty: trackStock ? stockQty : null,
    },
  }
}

export function normalizeGroceryFields(body: Record<string, unknown>) {
  const unitRaw = body.unit !== undefined ? String(body.unit || '').trim().toLowerCase() : undefined
  let unit: string | null | undefined = unitRaw
  if (unitRaw !== undefined) {
    if (!unitRaw) {
      unit = null
    } else if (!(PRODUCT_UNITS as readonly string[]).includes(unitRaw)) {
      return { ok: false as const, error: `unit must be one of: ${PRODUCT_UNITS.join(', ')}` }
    }
  }

  let unitValue: number | null | undefined
  if (body.unitValue !== undefined) {
    if (body.unitValue === null || body.unitValue === '') {
      unitValue = null
    } else {
      const n = Number(body.unitValue)
      if (!Number.isFinite(n) || n <= 0) {
        return { ok: false as const, error: 'unitValue must be a positive number' }
      }
      unitValue = n
    }
  }

  let aisle: string | null | undefined
  if (body.aisle !== undefined) {
    const raw = String(body.aisle || '').trim()
    aisle = raw ? raw.slice(0, 64) : null
  }

  return {
    ok: true as const,
    data: {
      ...(unit !== undefined ? { unit } : {}),
      ...(unitValue !== undefined ? { unitValue } : {}),
      ...(aisle !== undefined ? { aisle } : {}),
    },
  }
}

export function normalizeImagesList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => String(v || '').trim())
    .filter((v) => v.length > 0)
}

/** Build Prisma orderBy from admin list sort param. */
export function productListOrderBy(sort: string | null) {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' as const }]
    case 'name':
      return [{ name: 'asc' as const }]
    case 'price_asc':
      return [{ price: 'asc' as const }]
    case 'price_desc':
      return [{ price: 'desc' as const }]
    case 'stock':
      return [
        { trackStock: 'desc' as const },
        { stockQty: 'asc' as const },
        { name: 'asc' as const },
      ]
    case 'newest':
    default:
      return [{ createdAt: 'desc' as const }]
  }
}

export function buildAdminProductWhere(params: {
  storeId: string
  category?: string | null
  search?: string | null
  availability?: string | null
  archived?: boolean
  ids?: string[]
}) {
  const where: Record<string, unknown> = {
    storeId: params.storeId,
  }

  if (params.archived) {
    where.tags = { has: ARCHIVED_PRODUCT_TAG }
  } else {
    where.NOT = { tags: { has: ARCHIVED_PRODUCT_TAG } }
  }

  if (params.ids && params.ids.length > 0) {
    where.id = { in: params.ids }
  }

  if (params.category && params.category !== 'all') {
    where.category = params.category
  }

  if (params.availability === 'available') {
    where.isAvailable = true
  } else if (params.availability === 'unavailable') {
    where.isAvailable = false
  }

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { sku: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  return where
}
