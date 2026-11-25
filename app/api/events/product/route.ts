import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'
import { PRODUCT_EVENT_SOURCES, PRODUCT_EVENT_TYPES } from '@/lib/product-events'

/**
 * Shopper actions for the product stats: a product opened from a list
 * ("click") and added to cart. Sent in small batches by lib/product-events.ts
 * (often with navigator.sendBeacon, so the body may arrive as plain text).
 * Counts only; nothing here is shown to other shoppers.
 */

const MAX_EVENTS = 25

export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ ok: false }, { status: 404 })

    const body = await request
      .text()
      .then((text) => JSON.parse(text || '{}'))
      .catch(() => ({}))
    const sessionId = String(body?.sessionId || '').trim().slice(0, 80) || null
    const events = (Array.isArray(body?.events) ? body.events : [])
      .slice(0, MAX_EVENTS)
      .map((event: Record<string, unknown>) => ({
        productId: String(event?.productId || '').trim().slice(0, 40),
        type: String(event?.type || ''),
        source: String(event?.source || 'other'),
        quantity: Math.min(Math.max(Math.round(Number(event?.quantity) || 1), 1), 50),
      }))
      .filter(
        (event: { productId: string; type: string }) =>
          event.productId && (PRODUCT_EVENT_TYPES as readonly string[]).includes(event.type)
      )
    if (!events.length) return NextResponse.json({ ok: true, saved: 0 })

    // Only products of this store.
    const known = await prisma.product.findMany({
      where: { storeId: storeContext.store.id, id: { in: Array.from(new Set(events.map((e: { productId: string }) => e.productId))) } },
      select: { id: true },
    })
    const ids = new Set(known.map((product) => product.id))
    const userId = (await resolveUserId(request).catch(() => null)) || null

    const rows = events
      .filter((event: { productId: string }) => ids.has(event.productId))
      .map((event: { productId: string; type: string; source: string; quantity: number }) => ({
        storeId: storeContext.store.id,
        productId: event.productId,
        type: event.type,
        source: (PRODUCT_EVENT_SOURCES as readonly string[]).includes(event.source) ? event.source : 'other',
        quantity: event.quantity,
        sessionId,
        userId,
      }))
    if (rows.length) await prisma.productEvent.createMany({ data: rows })
    return NextResponse.json({ ok: true, saved: rows.length })
  } catch (error) {
    console.error('Error saving product events:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
