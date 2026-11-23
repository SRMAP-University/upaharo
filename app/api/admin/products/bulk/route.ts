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

// addTags / removeTags: put products into, or take them out of, extra shop
// categories, occasions and recipient groups (all saved as tags with the name).
const ACTIONS = ['enable', 'disable', 'delete', 'setCategory', 'restore', 'addTags', 'removeTags'] as const
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
        category: true,
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
    } else if (action === 'addTags' || action === 'removeTags') {
      const wanted = Array.from(
        new Set(
          (Array.isArray(body?.tags) ? body.tags : [])
            .map((tag: unknown) => String(tag || '').trim())
            .filter((tag: string) => tag.length > 0)
        )
      ).slice(0, 20) as string[]
      if (!wanted.length) {
        return NextResponse.json({ error: 'Choose a category or occasion' }, { status: 400 })
      }
      // Only names of this store's categories (shop, occasion or recipient), never free text.
      const known = await prisma.category.findMany({
        where: { storeId: storeContext.store.id, name: { in: wanted } },
        select: { name: true },
      })
      const knownNames = new Set(known.map((category) => category.name))
      if (wanted.some((tag) => !knownNames.has(tag))) {
        return NextResponse.json({ error: 'Unknown category or occasion' }, { status: 400 })
      }
      for (const product of products) {
        if (product.tags.includes(ARCHIVED_PRODUCT_TAG)) continue
        const next =
          action === 'addTags'
            ? Array.from(new Set([...product.tags, ...wanted.filter((tag) => tag !== product.category)]))
            : product.tags.filter((tag) => !wanted.includes(tag))
        if (next.length === product.tags.length && next.every((tag, i) => tag === product.tags[i])) continue
        await prisma.product.update({ where: { id: product.id }, data: { tags: next } })
        updated += 1
      }
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
