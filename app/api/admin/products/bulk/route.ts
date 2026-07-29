import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  ARCHIVED_PRODUCT_TAG,
  appendArchivedProductTag,
  stripArchivedProductTag,
} from '@/lib/product-archive'
import { redis, REDIS_KEYS } from '@/lib/redis'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

const ACTIONS = ['enable', 'disable', 'delete', 'setCategory', 'restore'] as const
type BulkAction = (typeof ACTIONS)[number]

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const body = await request.json()
    const action = String(body?.action || '') as BulkAction
    const rawIds = Array.isArray(body?.ids) ? body.ids : []
    const ids = Array.from(
      new Set(
        rawIds
          .map((id: unknown) => String(id || '').trim())
          .filter((id: string) => id.length > 0)
      )
    ).slice(0, 200) as string[]

    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    if (!ids.length) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    const products = await prisma.product.findMany({
      where: { storeId: storeContext.store.id, id: { in: ids } },
      select: {
        id: true,
        tags: true,
        _count: { select: { orderItems: true } },
      },
    })

    if (!products.length) {
      return NextResponse.json({ error: 'No matching products' }, { status: 404 })
    }

    let updated = 0
    let archived = 0
    let deleted = 0

    if (action === 'enable' || action === 'disable') {
      const result = await prisma.product.updateMany({
        where: {
          storeId: storeContext.store.id,
          id: { in: products.map((p) => p.id) },
          NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        },
        data: { isAvailable: action === 'enable' },
      })
      updated = result.count
    } else if (action === 'setCategory') {
      const category = String(body?.category || '').trim()
      if (
        !category ||
        !(await prisma.category.findFirst({
          where: {
            name: { equals: category, mode: 'insensitive' },
            storeId: storeContext.store.id,
          },
          select: { id: true },
        }))
      ) {
        return NextResponse.json({ error: 'Invalid product category' }, { status: 400 })
      }
      const result = await prisma.product.updateMany({
        where: {
          storeId: storeContext.store.id,
          id: { in: products.map((p) => p.id) },
          NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
        },
        data: { category },
      })
      updated = result.count
    } else if (action === 'restore') {
      for (const product of products) {
        if (!product.tags.includes(ARCHIVED_PRODUCT_TAG)) continue
        await prisma.product.update({
          where: { id: product.id },
          data: {
            tags: stripArchivedProductTag(product.tags),
            isAvailable: false,
          },
        })
        updated += 1
      }
    } else if (action === 'delete') {
      for (const product of products) {
        if (product.tags.includes(ARCHIVED_PRODUCT_TAG)) continue
        if (product._count.orderItems > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              isAvailable: false,
              tags: appendArchivedProductTag(product.tags),
            },
          })
          archived += 1
        } else {
          await prisma.product.delete({ where: { id: product.id } })
          deleted += 1
        }
      }
    }

    await redis.del(REDIS_KEYS.HOME(storeContext.slug))
    for (const product of products) {
      await redis.del(REDIS_KEYS.PRODUCT_DETAIL(storeContext.slug, product.id))
    }

    return NextResponse.json({
      ok: true,
      action,
      matched: products.length,
      updated,
      archived,
      deleted,
    })
  } catch (error) {
    console.error('Bulk products error:', error)
    return NextResponse.json({ error: 'Failed to run bulk action' }, { status: 500 })
  }
}
