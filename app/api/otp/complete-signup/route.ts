import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, verifyToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import {
  issueTrustedDevice,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const signupToken = String(body?.signupToken || '').trim()
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim().toLowerCase()
    const deviceIdFromBody = normalizeDeviceId(body?.deviceId)
    const platform =
      typeof body?.platform === 'string' ? body.platform : null

    if (!signupToken) {
      return NextResponse.json(
        { error: 'Signup token is required' },
        { status: 400 }
      )
    }

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address' },
        { status: 400 }
      )
    }

    const payload = await verifyToken(signupToken)
    if (
      !payload ||
      payload.purpose !== 'otp_signup' ||
      typeof payload.phone !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Signup session expired. Please verify OTP again.' },
        { status: 401 }
      )
    }

    const phone = normalizeNepalPhone(payload.phone)
    if (!phone) {
      return NextResponse.json(
        { error: 'Invalid phone on signup token' },
        { status: 400 }
      )
    }

    const deviceId =
      deviceIdFromBody ||
      (typeof payload.deviceId === 'string'
        ? normalizeDeviceId(payload.deviceId)
        : null)

    const existingPhone = await prisma.user.findUnique({
      where: { phone },
      select: userSelect,
    })
    if (existingPhone) {
      const token = await signToken({
        userId: existingPhone.id,
        email: existingPhone.email,
      })
      let deviceToken: string | undefined
      let deviceExpiresAt: string | undefined
      if (deviceId) {
        const trusted = await issueTrustedDevice({
          userId: existingPhone.id,
          phone,
          deviceId,
          platform,
        })
        deviceToken = trusted.deviceToken
        deviceExpiresAt = trusted.expiresAt.toISOString()
      }
      return NextResponse.json({
        user: existingPhone,
        token,
        deviceToken,
        deviceExpiresAt,
      })
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json(
        {
          error:
            'Email already registered. Sign in with email or use another.',
        },
        { status: 400 }
      )
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password: null,
      },
      select: userSelect,
    })

    const token = await signToken({ userId: user.id, email: user.email })
    let deviceToken: string | undefined
    let deviceExpiresAt: string | undefined
    if (deviceId) {
      const trusted = await issueTrustedDevice({
        userId: user.id,
        phone,
        deviceId,
        platform,
      })
      deviceToken = trusted.deviceToken
      deviceExpiresAt = trusted.expiresAt.toISOString()
    }

    return NextResponse.json(
      { user, token, deviceToken, deviceExpiresAt },
      { status: 201 }
    )
  } catch (error: unknown) {
    console.error('OTP complete-signup error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
