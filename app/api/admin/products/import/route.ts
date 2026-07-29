import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG, sanitizeProductTags } from '@/lib/product-archive'
import {
  csvRowsToObjects,
  mapNativeCsvRow,
  mapRasanmartCsvRow,
  parseCsv,
  type NormalizedImportRow,
} from '@/lib/product-csv'
import { withProductWriteCompatibility } from '@/lib/product-db'
import { PRODUCT_UNITS } from '@/lib/product-fields'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

const MAX_ROWS = 2000

async function resolveCategoryName(
  storeId: string,
  categoryName: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const key = categoryName.toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null

  const found = await prisma.category.findFirst({
    where: {
      storeId,
      name: { equals: categoryName, mode: 'insensitive' },
    },
    select: { name: true },
  })
  const resolved = found?.name ?? null
  cache.set(key, resolved)
  return resolved
}

function sanitizeUnit(unit: string | null): string | null {
  if (!unit) return null
  return (PRODUCT_UNITS as readonly string[]).includes(unit) ? unit : null
}

async function upsertImportRow(
  storeId: string,
  row: NormalizedImportRow,
  categoryCache: Map<string, string | null>
): Promise<'created' | 'updated'> {
  const category = await resolveCategoryName(storeId, row.category, categoryCache)
  if (!category) {
    throw new Error(`Unknown category: ${row.category}`)
  }

  const unit = sanitizeUnit(row.unit)
  const data = {
    storeId,
    name: row.name,
    category,
    price: row.price,
    wholesalePrice: row.wholesalePrice,
    image: row.image,
    images: [] as string[],
    sku: row.sku,
    trackStock: row.trackStock,
    stockQty: row.trackStock ? row.stockQty ?? 0 : null,
    unit,
    unitValue: row.unitValue,
    aisle: row.aisle,
    isAvailable: row.isAvailable,
    discount: row.discount,
    miniDescription: row.miniDescription || null,
    description: row.description || null,
    tags: sanitizeProductTags([]),
    variants: [] as object[],
  }

  if (row.sku) {
    const existing = await prisma.product.findFirst({
      where: {
        storeId,
        sku: row.sku,
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
      select: { id: true },
    })
    if (existing) {
      await withProductWriteCompatibility(data, (safeData) =>
        prisma.product.update({
          where: { id: existing.id },
          data: {
            name: safeData.name,
            category: safeData.category,
            price: safeData.price,
            wholesalePrice: safeData.wholesalePrice,
            image: safeData.image,
            trackStock: safeData.trackStock,
            stockQty: safeData.stockQty,
            unit: safeData.unit,
            unitValue: safeData.unitValue,
            aisle: safeData.aisle,
            isAvailable: safeData.isAvailable,
            discount: safeData.discount,
            miniDescription: safeData.miniDescription,
            description: safeData.description,
          },
        })
      )
      return 'updated'
    }
  }

  await withProductWriteCompatibility(data, (safeData) => prisma.product.create({ data: safeData }))
  return 'created'
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const contentType = request.headers.get('content-type') || ''
    let csvText = ''
    let format = 'native'

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      format = String(form.get('format') || 'native').toLowerCase()
      const file = form.get('file')
      if (file && typeof file === 'object' && 'text' in file) {
        csvText = await (file as File).text()
      } else {
        csvText = String(form.get('csv') || '')
      }
    } else {
      const body = await request.json().catch(() => ({}))
      csvText = String(body?.csv || '')
      format = String(body?.format || 'native').toLowerCase()
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'CSV content required' }, { status: 400 })
    }

    const { headers, rows } = parseCsv(csvText)
    if (!headers.length) {
      return NextResponse.json({ error: 'CSV has no header row' }, { status: 400 })
    }

    const objects = csvRowsToObjects(headers, rows).slice(0, MAX_ROWS)
    const mapper = format === 'rasanmart' ? mapRasanmartCsvRow : mapNativeCsvRow
    const categoryCache = new Map<string, string | null>()

    let created = 0
    let updated = 0
    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < objects.length; i++) {
      const mapped = mapper(objects[i])
      if (!mapped.ok) {
        errors.push({ row: i + 2, error: mapped.error })
        continue
      }
      try {
        const result = await upsertImportRow(storeContext.store.id, mapped.data, categoryCache)
        if (result === 'created') created += 1
        else updated += 1
      } catch (err) {
        errors.push({
          row: i + 2,
          error: err instanceof Error ? err.message : 'Failed to import row',
        })
      }
    }

    await redis.del(REDIS_KEYS.HOME(storeContext.slug))

    return NextResponse.json({
      ok: true,
      format,
      created,
      updated,
      errors,
      processed: objects.length,
    })
  } catch (error) {
    console.error('Import products error:', error)
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 })
  }
}
