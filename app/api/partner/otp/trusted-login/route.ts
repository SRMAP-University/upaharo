import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { normalizeNepalPhone } from '@/lib/phone'
import {
  authenticateTrustedDevice,
  normalizeDeviceId,
} from '@/lib/trusted-device'
import { loadPartnerByUserId } from '@/lib/partner-auth'

/**
 * Partner-app skip-OTP login when this install was previously verified.
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
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
        fullAccess: partner.access.fullAccess,
        sellerId: partner.sellerId,
        deliveryPartnerId: partner.deliveryPartnerId,
      },
      token,
      trusted: true,
    })
  } catch (error) {
    console.error('Partner trusted login error:', error)
    return NextResponse.json(
      { error: 'Failed to sign in with trusted device' },
      { status: 500 }
    )
  }
}
