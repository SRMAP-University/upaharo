import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

/** List in-app notification inbox for the authenticated user (current store). */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Unknown store' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 40), 100)
    const unreadOnly = searchParams.get('unread') === '1'
    const storeFilter = { userId, storeId: storeContext.store.id }

    const notifications = await prisma.appNotification.findMany({
      where: {
        ...storeFilter,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.appNotification.count({
      where: { ...storeFilter, readAt: null },
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Notifications list error:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

/** Mark notifications as read. Body: { ids?: string[], all?: boolean } */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Unknown store' }, { status: 400 })
    }

    const body = await request.json()
    const now = new Date()
    const storeId = storeContext.store.id

    if (body.all) {
      await prisma.appNotification.updateMany({
        where: { userId, storeId, readAt: null },
        data: { readAt: now },
      })
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await prisma.appNotification.updateMany({
        where: {
          userId,
          storeId,
          id: { in: body.ids.map(String) },
        },
        data: { readAt: now },
      })
    } else {
      return NextResponse.json({ error: 'Provide ids or all: true' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Notifications mark-read error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}
