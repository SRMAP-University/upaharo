import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildAdminProductWhere, productListOrderBy } from '@/lib/product-fields'
import { PRODUCT_CSV_COLUMNS, rowToCsvLine } from '@/lib/product-csv'
import { findManyProductsCompat } from '@/lib/product-db'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const availability = searchParams.get('availability')
    const archived = searchParams.get('archived') === '1'
    const sort = searchParams.get('sort')
    const exportAll = searchParams.get('all') === '1'

    const where = exportAll
      ? buildAdminProductWhere({
          storeId: storeContext.store.id,
          archived: false,
        })
      : buildAdminProductWhere({
          storeId: storeContext.store.id,
          category,
          search,
          availability,
          archived,
        })

    const products = await findManyProductsCompat({
      where,
      orderBy: productListOrderBy(sort),
      take: 5000,
    })

    const lines = [
      rowToCsvLine([...PRODUCT_CSV_COLUMNS]),
      ...products.map((p) =>
        rowToCsvLine([
          p.name,
          p.category,
          p.price,
          p.wholesalePrice ?? '',
          p.image,
          p.sku ?? '',
          p.trackStock ? (p.stockQty ?? 0) : '',
          p.unit ?? '',
          p.unitValue ?? '',
          p.aisle ?? '',
          p.isAvailable ? 'true' : 'false',
          p.discount ?? 0,
          p.miniDescription ?? '',
          p.description ?? '',
        ])
      ),
    ]

    const csv = lines.join('\n')
    const filename = `products-${storeContext.slug}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Export products error:', error)
    return NextResponse.json({ error: 'Failed to export products' }, { status: 500 })
  }
}
