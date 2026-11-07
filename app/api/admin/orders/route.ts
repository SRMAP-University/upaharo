import { NextRequest, NextResponse } from 'next/server'
import { OrderSource } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ADMIN_ORDER_INCLUDE, toAdminOrder } from '@/lib/admin-order-view'
import { createOfflineOrder } from '@/lib/offline-order'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const sourceParam = request.nextUrl.searchParams.get('source')
    const sourceFilter =
      sourceParam === 'OFFLINE' || sourceParam === 'UPAHARO'
        ? { source: sourceParam as OrderSource }
        : {}

    // Hide ONLINE checkouts that are still unpaid — they are not real orders yet.
    const orders = await prisma.order.findMany({
      where: {
        storeId: storeContext.store.id,
        ...sourceFilter,
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
      },
      include: ADMIN_ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders.map(toAdminOrder), {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        Vary: 'Cookie',
      },
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const result = await createOfflineOrder({
      storeId: storeContext.store.id,
      storeSlug: storeContext.slug,
      items: Array.isArray(body?.items) ? body.items : [],
      customerName: body?.customerName,
      customerPhone: body?.customerPhone,
      channel: body?.channel,
      fulfillmentType: body?.fulfillmentType,
      paymentMethod: body?.paymentMethod,
      paymentStatus: body?.paymentStatus,
      status: body?.status,
      discount: body?.discount,
      deliveryFee: body?.deliveryFee,
      estimatedTime: body?.estimatedTime,
      note: body?.note,
      address: body?.address ?? null,
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error.error }, { status: result.error.status })
    }

    return NextResponse.json(result.order, { status: 201 })
  } catch (error) {
    console.error('Error creating offline order:', error)
    return NextResponse.json({ error: 'Failed to create offline order' }, { status: 500 })
  }
}
