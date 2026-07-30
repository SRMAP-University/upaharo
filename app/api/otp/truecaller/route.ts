import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import { PHONE_OTP_SIGNUP_TOKEN_TTL } from '@/lib/phone-otp'
import {
  exchangeTruecallerCode,
  fetchTruecallerUserInfo,
  truecallerDisplayName,
} from '@/lib/truecaller'
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
    const authorizationCode =
      typeof body?.authorizationCode === 'string'
        ? body.authorizationCode.trim()
        : typeof body?.code === 'string'
          ? body.code.trim()
          : ''
    const codeVerifier =
      typeof body?.codeVerifier === 'string' ? body.codeVerifier.trim() : ''
    const deviceId = normalizeDeviceId(body?.deviceId)
    const platform =
      typeof body?.platform === 'string' ? body.platform : null

    if (!authorizationCode || !codeVerifier) {
      return NextResponse.json(
        { error: 'Missing Truecaller authorization code or code verifier' },
        { status: 400 }
      )
    }

    const { accessToken } = await exchangeTruecallerCode({
      authorizationCode,
      codeVerifier,
    })
    const profile = await fetchTruecallerUserInfo(accessToken)
    const phone = normalizeNepalPhone(profile.phone_number)

    if (!phone) {
      return NextResponse.json(
        {
          error:
            'Truecaller phone is missing or not a valid Nepal mobile number',
        },
        { status: 400 }
      )
    }

    if (profile.phone_number_verified === false) {
      return NextResponse.json(
        { error: 'Truecaller phone number is not verified' },
        { status: 403 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: userSelect,
    })

    if (user) {
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
      return NextResponse.json({
        user,
        token,
        needsSignup: false,
        deviceToken,
        deviceExpiresAt,
        truecaller: {
          name: truecallerDisplayName(profile),
          email: profile.email ?? null,
        },
      })
    }

    const suggestedName = truecallerDisplayName(profile)
    const suggestedEmail =
      typeof profile.email === 'string' && profile.email.includes('@')
        ? profile.email.trim()
        : null

    const signupToken = await signToken(
      {
        phone,
        purpose: 'otp_signup',
        deviceId: deviceId ?? undefined,
        suggestedName: suggestedName ?? undefined,
        suggestedEmail: suggestedEmail ?? undefined,
      },
      PHONE_OTP_SIGNUP_TOKEN_TTL
    )

    return NextResponse.json({
      needsSignup: true,
      signupToken,
      phone,
      suggestedName,
      suggestedEmail,
    })
  } catch (error) {
    console.error('Truecaller login error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to verify with Truecaller'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
