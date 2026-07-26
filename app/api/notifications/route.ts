import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'

/** List in-app notification inbox for the authenticated user. */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 40), 100)
    const unreadOnly = searchParams.get('unread') === '1'

    const notifications = await prisma.appNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const unreadCount = await prisma.appNotification.count({
      where: { userId, readAt: null },
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

    const body = await request.json()
    const now = new Date()

    if (body.all) {
      await prisma.appNotification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: now },
      })
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await prisma.appNotification.updateMany({
        where: { userId, id: { in: body.ids.map(String) } },
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
