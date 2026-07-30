import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import {
  normalizePhoneOtpInput,
  phoneOtpsMatch,
  PHONE_OTP_MAX_ATTEMPTS,
} from '@/lib/phone-otp'
import {
  issueTrustedDevice,
  normalizeDeviceId,
} from '@/lib/trusted-device'
import { loadPartnerByUserId } from '@/lib/partner-auth'

/**
 * Partner-app OTP verify. Same OTP table as customer, but only users with
 * PartnerAccess (seller and/or delivery enabled) may log in.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = normalizeNepalPhone(body?.phone)
    const code = normalizePhoneOtpInput(body?.code ?? body?.otp)
    const deviceId = normalizeDeviceId(body?.deviceId)
    const platform =
      typeof body?.platform === 'string' ? body.platform : null

    if (!phone) {
      return NextResponse.json(
        { error: 'Enter a valid Nepal mobile number' },
        { status: 400 }
      )
    }

    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Enter the 6-digit OTP' },
        { status: 400 }
      )
    }

    const otpRow = await prisma.phoneOtp.findUnique({ where: { phone } })
    if (!otpRow) {
      return NextResponse.json(
        { error: 'No OTP found. Please request a new code.' },
        { status: 400 }
      )
    }

    if (otpRow.expiresAt.getTime() < Date.now()) {
      await prisma.phoneOtp.delete({ where: { phone } }).catch(() => null)
      return NextResponse.json(
        { error: 'OTP expired. Please request a new code.' },
        { status: 400 }
      )
    }

    if (otpRow.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await prisma.phoneOtp.delete({ where: { phone } }).catch(() => null)
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 429 }
      )
    }

    if (!phoneOtpsMatch(otpRow.codeHash, code)) {
      await prisma.phoneOtp.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 401 })
    }

    await prisma.phoneOtp.delete({ where: { phone } }).catch(() => null)

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        image: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          error:
            'No partner account for this number. Ask admin to register you as a partner.',
        },
        { status: 403 }
      )
    }

    const partner = await loadPartnerByUserId(user.id)
    if (!partner) {
      return NextResponse.json(
        {
          error:
            'Partner access is not enabled for this account. Contact admin.',
        },
        { status: 403 }
      )
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      partner: true,
      sellerEnabled: partner.access.sellerEnabled,
      deliveryEnabled: partner.access.deliveryEnabled,
    })

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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        image: user.image,
      },
      partner: {
        sellerEnabled: partner.access.sellerEnabled,
        deliveryEnabled: partner.access.deliveryEnabled,
        giftsEnabled: partner.access.giftsEnabled,
        groceryEnabled: partner.access.groceryEnabled,
        sellerId: partner.sellerId,
        deliveryPartnerId: partner.deliveryPartnerId,
      },
      token,
      deviceToken,
      deviceExpiresAt,
    })
  } catch (error) {
    console.error('Partner OTP verify error:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
