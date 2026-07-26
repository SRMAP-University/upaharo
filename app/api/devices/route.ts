import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'

/** Register or refresh an FCM device token for the authenticated user. */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const token = String(body.token || '').trim()
    const platform = String(body.platform || 'android').toLowerCase()

    if (!token || token.length < 20) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    if (!['android', 'ios', 'web'].includes(platform)) {
      return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
    }

    const device = await prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform, updatedAt: new Date() },
    })

    return NextResponse.json({ ok: true, id: device.id })
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

    const body = await request.json().catch(() => ({}))
    const token = String(body.token || '').trim()

    if (token) {
      await prisma.deviceToken.deleteMany({ where: { userId, token } })
    } else {
      // Clear all devices for this user if no token provided
      await prisma.deviceToken.deleteMany({ where: { userId } })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Device unregister error:', error)
    return NextResponse.json({ error: 'Failed to unregister device' }, { status: 500 })
  }
}
