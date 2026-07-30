import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import {
  authenticateTrustedDevice,
  normalizeDeviceId,
} from '@/lib/trusted-device'

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  image: true,
  createdAt: true,
  updatedAt: true,
} as const

/**
 * Skip OTP when this install was previously verified for the same phone.
 * Body: { phone, deviceId, deviceToken }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = normalizeNepalPhone(body?.phone)
    const deviceId = normalizeDeviceId(body?.deviceId)
    const deviceToken = String(body?.deviceToken || '').trim()

    if (!phone || !deviceId || !deviceToken) {
      return NextResponse.json(
        { error: 'phone, deviceId, and deviceToken are required' },
        { status: 400 }
      )
    }

    const auth = await authenticateTrustedDevice({
      phone,
      deviceId,
      deviceToken,
    })

    if (!auth) {
      return NextResponse.json(
        { error: 'Device not trusted. Please verify with OTP.' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const token = await signToken({ userId: user.id, email: user.email })
    return NextResponse.json({ user, token, trusted: true })
  } catch (error) {
    console.error('Trusted login error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in with trusted device' },
      { status: 500 }
    )
  }
}
