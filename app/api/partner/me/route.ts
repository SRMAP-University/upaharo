import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requirePartner,
  allowedStoreSlugs,
} from '@/lib/partner-auth'
import { normalizeNepalPhone } from '@/lib/phone'

export async function GET(request: NextRequest) {
  try {
    const partner = await requirePartner(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [seller, deliveryPartner] = await Promise.all([
      partner.sellerId
        ? prisma.seller.findUnique({
            where: { id: partner.sellerId },
            select: {
              id: true,
              businessName: true,
              businessAddress: true,
              gstin: true,
              phone: true,
              email: true,
              commission: true,
              isActive: true,
              isVerified: true,
              bankAccountName: true,
              bankAccountNo: true,
              ifscCode: true,
              panNumber: true,
            },
          })
        : null,
      partner.deliveryPartnerId
        ? prisma.deliveryPartner.findUnique({
            where: { id: partner.deliveryPartnerId },
            select: {
              id: true,
              vehicleType: true,
              vehicleNumber: true,
              isAvailable: true,
              currentLat: true,
              currentLng: true,
            },
          })
        : null,
    ])

    return NextResponse.json({
      user: {
        id: partner.userId,
        email: partner.email,
        name: partner.name,
        phone: partner.phone,
        role: partner.role,
      },
      access: partner.access,
      storeSlugs: allowedStoreSlugs(partner.access),
      seller,
      deliveryPartner,
    })
  } catch (error) {
    console.error('Partner me GET error:', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const partner = await requirePartner(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Promise<unknown>[] = []

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.push(
        prisma.user.update({
          where: { id: partner.userId },
          data: { name: body.name.trim() },
        })
      )
    }

    if (partner.deliveryPartnerId && body.vehicle) {
      const vehicleType =
        typeof body.vehicle.vehicleType === 'string'
          ? body.vehicle.vehicleType.trim()
          : undefined
      const vehicleNumber =
        typeof body.vehicle.vehicleNumber === 'string'
          ? body.vehicle.vehicleNumber.trim()
          : undefined
      updates.push(
        prisma.deliveryPartner.update({
          where: { id: partner.deliveryPartnerId },
          data: {
            ...(vehicleType ? { vehicleType } : {}),
            ...(vehicleNumber !== undefined ? { vehicleNumber } : {}),
          },
        })
      )
    }

    if (partner.sellerId && body.seller) {
      const s = body.seller as Record<string, unknown>
      updates.push(
        prisma.seller.update({
          where: { id: partner.sellerId },
          data: {
            ...(typeof s.businessName === 'string'
              ? { businessName: s.businessName.trim() }
              : {}),
            ...(typeof s.businessAddress === 'string'
              ? { businessAddress: s.businessAddress.trim() }
              : {}),
            ...(typeof s.bankAccountName === 'string'
              ? { bankAccountName: s.bankAccountName.trim() || null }
              : {}),
            ...(typeof s.bankAccountNo === 'string'
              ? { bankAccountNo: s.bankAccountNo.trim() || null }
              : {}),
            ...(typeof s.ifscCode === 'string'
              ? { ifscCode: s.ifscCode.trim() || null }
              : {}),
            ...(typeof s.panNumber === 'string'
              ? { panNumber: s.panNumber.trim() || null }
              : {}),
            ...(typeof s.phone === 'string'
              ? { phone: normalizeNepalPhone(s.phone) || s.phone }
              : {}),
          },
        })
      )
    }

    await Promise.all(updates)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Partner me PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
