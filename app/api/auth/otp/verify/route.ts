import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import {
  normalizePhoneOtpInput,
  phoneOtpsMatch,
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_SIGNUP_TOKEN_TTL,
} from '@/lib/phone-otp'

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
    const phone = normalizeNepalPhone(body?.phone)
    const code = normalizePhoneOtpInput(body?.code ?? body?.otp)

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
      select: userSelect,
    })

    if (user) {
      const token = await signToken({ userId: user.id, email: user.email })
      return NextResponse.json({ user, token, needsSignup: false })
    }

    const signupToken = await signToken(
      { phone, purpose: 'otp_signup' },
      PHONE_OTP_SIGNUP_TOKEN_TTL
    )

    return NextResponse.json({
      needsSignup: true,
      signupToken,
      phone,
    })
  } catch (error) {
    console.error('OTP verify error:', error)
    return NextResponse.json(
      { error: 'Failed to verify OTP' },
      { status: 500 }
    )
  }
}
