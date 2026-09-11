import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePartnerPhone } from '@/lib/phone'
import { issuePartnerAppSession } from '@/lib/partner-auth'
import { normalizeDeviceId } from '@/lib/trusted-device'
import {
  generatePhoneOtp,
  hashPhoneOtp,
  otpSmsMessage,
  PHONE_OTP_RESEND_COOLDOWN_MS,
  PHONE_OTP_TTL_MS,
} from '@/lib/phone-otp'
import { sendSms, SmsPasalError } from '@/lib/sms-pasal'

/**
 * Send OTP for partner login. Only phones with PartnerAccess may request codes
 * (avoids leaking OTPs to random numbers for this endpoint).
 * ADMIN accounts skip SMS and receive a session immediately.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phone = normalizePartnerPhone(body?.phone)

    if (!phone) {
      return NextResponse.json(
        {
          error: 'Enter a valid 10-digit mobile number',
        },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        role: true,
        partnerAccess: {
          select: {
            sellerEnabled: true,
            deliveryEnabled: true,
          },
        },
      },
    })

    const access = user?.partnerAccess
    const isAdmin = user?.role === 'ADMIN'
    if (
      !user ||
      !access ||
      (!isAdmin && !access.sellerEnabled && !access.deliveryEnabled)
    ) {
      // Same message as verify — do not reveal whether the phone exists.
      return NextResponse.json(
        {
          error:
            'No partner account for this number. Ask admin to register you as a partner.',
        },
        { status: 403 }
      )
    }

    if (isAdmin) {
      const session = await issuePartnerAppSession({
        userId: user.id,
        phone,
        deviceId: normalizeDeviceId(body?.deviceId),
        platform: typeof body?.platform === 'string' ? body.platform : null,
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
      return NextResponse.json({ ...session, ok: true, skipOtp: true })
    }

    const existing = await prisma.phoneOtp.findUnique({ where: { phone } })
    if (existing) {
      const elapsed = Date.now() - existing.updatedAt.getTime()
      if (elapsed < PHONE_OTP_RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil(
          (PHONE_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000
        )
        return NextResponse.json(
          {
            error: `Please wait ${retryAfter}s before requesting another code`,
            retryAfter,
          },
          { status: 429 }
        )
      }
    }

    const code = generatePhoneOtp()
    const codeHash = hashPhoneOtp(code)
    const expiresAt = new Date(Date.now() + PHONE_OTP_TTL_MS)

    await prisma.phoneOtp.upsert({
      where: { phone },
      create: { phone, codeHash, expiresAt, attempts: 0 },
      update: { codeHash, expiresAt, attempts: 0 },
    })

    try {
      await sendSms({ to: phone, message: otpSmsMessage(code) })
    } catch (err) {
      console.error('Partner SMS send failed:', err)
      const message =
        err instanceof SmsPasalError
          ? 'Failed to send OTP. Please try again.'
          : 'Failed to send OTP. Please try again.'
      return NextResponse.json({ error: message }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      expiresIn: Math.floor(PHONE_OTP_TTL_MS / 1000),
      resendIn: Math.floor(PHONE_OTP_RESEND_COOLDOWN_MS / 1000),
    })
  } catch (error) {
    console.error('Partner OTP send error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 }
    )
  }
}
