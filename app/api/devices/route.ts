import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

function normalizeClientApp(raw: unknown): 'customer' | 'partner' {
  const v = String(raw || 'customer').toLowerCase().trim()
  return v === 'partner' ? 'partner' : 'customer'
}

/** Register or refresh an FCM device token for the authenticated user + store. */
export async function POST(request: NextRequest) {
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
    const token = String(body.token || '').trim()
    const platform = String(body.platform || 'android').toLowerCase()
    const clientApp = normalizeClientApp(body.clientApp)

    if (!token || token.length < 20) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const device = await prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId,
        storeId: storeContext.store.id,
        token,
        platform,
        clientApp,
      },
      update: {
        userId,
        storeId: storeContext.store.id,
        platform,
        clientApp,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      id: device.id,
      store: storeContext.slug,
      clientApp: device.clientApp,
    })
  } catch (error) {
    console.error('Device register error:', error)
    return NextResponse.json({ error: 'Failed to register device' }, { status: 500 })
  }
}

/** Unregister a device token (logout / revoke). */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveStoreContext(request)
    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '').trim()
    const clientApp = body.clientApp != null ? normalizeClientApp(body.clientApp) : null

    if (token) {
      await prisma.deviceToken.deleteMany({
        where: {
          userId,
          token,
          ...(storeContext ? { storeId: storeContext.store.id } : {}),
        },
      })
    } else if (storeContext) {
      // Clear devices for this user in the current app only.
      await prisma.deviceToken.deleteMany({
        where: {
          userId,
          storeId: storeContext.store.id,
          ...(clientApp ? { clientApp } : {}),
        },
      })
    } else {
      await prisma.deviceToken.deleteMany({
        where: {
          userId,
          ...(clientApp ? { clientApp } : {}),
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Device unregister error:', error)
    return NextResponse.json({ error: 'Failed to unregister device' }, { status: 500 })
  }
}
