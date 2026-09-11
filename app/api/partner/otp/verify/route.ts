import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePartnerPhone } from '@/lib/phone'
import {
  normalizePhoneOtpInput,
  phoneOtpsMatch,
  PHONE_OTP_MAX_ATTEMPTS,
} from '@/lib/phone-otp'
import { normalizeDeviceId } from '@/lib/trusted-device'
import { issuePartnerAppSession } from '@/lib/partner-auth'

/**
 * Partner-app OTP verify. Same OTP table as customer, but only users with
 * PartnerAccess (seller and/or delivery enabled) may log in.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = normalizePartnerPhone(body?.phone)
    const code = normalizePhoneOtpInput(body?.code ?? body?.otp)
    const deviceId = normalizeDeviceId(body?.deviceId)
    const platform =
      typeof body?.platform === 'string' ? body.platform : null

    if (!phone) {
      return NextResponse.json(
        { error: 'Enter a valid 10-digit mobile number' },
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
      select: { id: true },
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

    const session = await issuePartnerAppSession({
      userId: user.id,
      phone,
      deviceId,
      platform,
    })
    if (!session) {
      return NextResponse.json(
        {
          error:
            'Partner access is not enabled for this account. Contact admin.',
        },
        { status: 403 }
      )
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error('Partner OTP verify error:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
