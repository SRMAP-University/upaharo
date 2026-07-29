import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyPromo, notifyUser } from '@/lib/notifications'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

/** Stats + recent marketing / promo notifications for the active admin store. */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Unknown store' }, { status: 400 })
    }

    const storeId = storeContext.store.id

    const [deviceUsers, deviceTokens, customerCount, recent] = await Promise.all([
      prisma.deviceToken.findMany({
        where: { storeId },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.deviceToken.count({ where: { storeId } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.appNotification.findMany({
        where: { storeId, type: { in: ['PROMO', 'GENERAL'] } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ])

    return NextResponse.json({
      stats: {
        customersWithDevices: deviceUsers.length,
        deviceTokens,
        totalCustomers: customerCount,
        store: storeContext.slug,
      },
      recent,
    })
  } catch (error) {
    console.error('Admin notifications GET error:', error)
    return NextResponse.json({ error: 'Failed to load notifications' }, { status: 500 })
  }
}

/**
 * Send marketing / general push for the active admin store only.
 * Body:
 *  - title, body (required)
 *  - audience: "devices" | "all" | "email"  (default devices)
 *  - email?: string (when audience=email)
 *  - userId?: string
 *  - type?: PROMO | GENERAL  (default PROMO)
 *  - deepLink?: string
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Unknown store' }, { status: 400 })
    }

    const storeId = storeContext.store.id
    const storeSlug = storeContext.slug

    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.body || '').trim()
    const type = body.type === 'GENERAL' ? 'GENERAL' : 'PROMO'
    const audience = String(body.audience || 'devices')
    const deepLink = String(body.deepLink || '/home').trim() || '/home'

    if (!title || !message) {
      return NextResponse.json({ error: 'title and body required' }, { status: 400 })
    }

    let userIds: string[] = []

    if (audience === 'all' || body.allCustomers) {
      const users = await prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        select: { id: true },
      })
      userIds = users.map((u) => u.id)
    } else if (audience === 'email' || body.email) {
      const email = String(body.email || '').trim().toLowerCase()
      if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 })
      }
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })
      if (!user) {
        return NextResponse.json({ error: 'No user with that email' }, { status: 404 })
      }
      userIds = [user.id]
    } else if (body.userId) {
      userIds = [String(body.userId)]
    } else if (Array.isArray(body.userIds)) {
      userIds = body.userIds.map(String)
    } else {
      // Default: only customers with a registered FCM device for this store
      const devices = await prisma.deviceToken.findMany({
        where: { storeId },
        distinct: ['userId'],
        select: { userId: true },
      })
      userIds = devices.map((d) => d.userId)
    }

    if (!userIds.length) {
      const tokenCount = await prisma.deviceToken.count({ where: { storeId } })
      return NextResponse.json(
        {
          error:
            tokenCount === 0
              ? `No ${storeSlug} app devices registered yet. Open the ${
                  storeSlug === 'grocery' ? 'Upaharo Grocery' : 'Upaharo'
                } app, log in, allow notifications, then reopen the app.`
              : 'No matching recipients for this audience. Try “Everyone with the app”, or send to the exact email used in the mobile app.',
          deviceTokens: tokenCount,
          store: storeSlug,
        },
        { status: 400 }
      )
    }

    const data = {
      type,
      route: deepLink,
      storeSlug,
      ...(typeof body.data === 'object' && body.data ? body.data : {}),
    }

    let pushDelivered = 0
    for (const userId of userIds) {
      const result =
        type === 'PROMO'
          ? await notifyPromo({
              userId,
              title,
              body: message,
              data,
              storeId,
              storeSlug,
            })
          : await notifyUser({
              userId,
              type: 'GENERAL',
              title,
              body: message,
              data: { type: 'GENERAL', ...data },
              storeId,
              storeSlug,
            })
      pushDelivered += result.pushSuccess
    }

    const devicesTargeted = await prisma.deviceToken.count({
      where: { userId: { in: userIds }, storeId },
    })
    const { firebaseServiceAccount } = await import('@/lib/firebase-sa.generated')
    const fcmConfigured = Boolean(
      firebaseServiceAccount || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    )

    return NextResponse.json({
      ok: true,
      recipients: userIds.length,
      devicesTargeted,
      pushDelivered,
      fcmConfigured,
      store: storeSlug,
      warning: !fcmConfigured
        ? 'Saved to inbox, but push is disabled: FIREBASE_SERVICE_ACCOUNT_JSON is not set on the server.'
        : devicesTargeted > 0 && pushDelivered === 0
          ? 'FCM sent 0 successfully. Check the service account JSON / token validity.'
          : undefined,
      type,
      audience,
    })
  } catch (error) {
    console.error('Admin notification error:', error)
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
