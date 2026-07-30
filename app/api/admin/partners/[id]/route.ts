import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { normalizeNepalPhone } from '@/lib/phone'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params
    const body = await request.json()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partnerAccess: true,
        seller: true,
        deliveryPartner: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const sellerEnabled =
      body.sellerEnabled !== undefined
        ? Boolean(body.sellerEnabled)
        : user.partnerAccess?.sellerEnabled ?? Boolean(user.seller)
    const deliveryEnabled =
      body.deliveryEnabled !== undefined
        ? Boolean(body.deliveryEnabled)
        : user.partnerAccess?.deliveryEnabled ?? Boolean(user.deliveryPartner)
    const giftsEnabled =
      body.giftsEnabled !== undefined
        ? Boolean(body.giftsEnabled)
        : user.partnerAccess?.giftsEnabled ?? true
    const groceryEnabled =
      body.groceryEnabled !== undefined
        ? Boolean(body.groceryEnabled)
        : user.partnerAccess?.groceryEnabled ?? false

    if (!sellerEnabled && !deliveryEnabled) {
      return NextResponse.json(
        { error: 'Enable at least Merchant or Delivery' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (typeof body.name === 'string' && body.name.trim()) {
        await tx.user.update({
          where: { id: userId },
          data: {
            name: body.name.trim(),
            role: sellerEnabled ? 'SELLER' : 'DELIVERY_PARTNER',
          },
        })
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { role: sellerEnabled ? 'SELLER' : 'DELIVERY_PARTNER' },
        })
      }

      await tx.partnerAccess.upsert({
        where: { userId },
        create: {
          userId,
          sellerEnabled,
          deliveryEnabled,
          giftsEnabled,
          groceryEnabled,
        },
        update: {
          sellerEnabled,
          deliveryEnabled,
          giftsEnabled,
          groceryEnabled,
        },
      })

      if (sellerEnabled) {
        const sellerData = {
          businessName:
            typeof body.businessName === 'string'
              ? body.businessName.trim()
              : undefined,
          businessAddress:
            typeof body.businessAddress === 'string'
              ? body.businessAddress.trim()
              : undefined,
          gstin: body.gstin !== undefined ? body.gstin || null : undefined,
          commission:
            body.commission !== undefined
              ? Number(body.commission)
              : undefined,
          isActive:
            body.isActive !== undefined ? Boolean(body.isActive) : undefined,
          isVerified:
            body.isVerified !== undefined
              ? Boolean(body.isVerified)
              : undefined,
          bankAccountName:
            body.bankAccountName !== undefined
              ? body.bankAccountName || null
              : undefined,
          bankAccountNo:
            body.bankAccountNo !== undefined
              ? body.bankAccountNo || null
              : undefined,
          ifscCode:
            body.ifscCode !== undefined ? body.ifscCode || null : undefined,
          panNumber:
            body.panNumber !== undefined ? body.panNumber || null : undefined,
          phone:
            body.phone !== undefined
              ? normalizeNepalPhone(body.phone) || body.phone
              : undefined,
          email:
            typeof body.email === 'string' ? body.email.trim() : undefined,
        }

        const cleaned = Object.fromEntries(
          Object.entries(sellerData).filter(([, v]) => v !== undefined)
        )

        if (user.seller) {
          await tx.seller.update({
            where: { userId },
            data: cleaned,
          })
        } else {
          await tx.seller.create({
            data: {
              userId,
              businessName:
                String(body.businessName || user.name).trim() || user.name,
              businessAddress:
                String(body.businessAddress || '').trim() || '—',
              phone: user.phone || '',
              email: user.email,
              commission: Number(body.commission) || 15,
              isActive: true,
              isVerified: Boolean(body.isVerified),
              ...cleaned,
            },
          })
        }
      } else if (user.seller) {
        await tx.seller.update({
          where: { userId },
          data: { isActive: false },
        })
      }

      if (deliveryEnabled) {
        const vehicleType =
          typeof body.vehicleType === 'string'
            ? body.vehicleType.trim()
            : 'bike'
        const vehicleNumber =
          typeof body.vehicleNumber === 'string'
            ? body.vehicleNumber.trim()
            : ''

        if (user.deliveryPartner) {
          await tx.deliveryPartner.update({
            where: { userId },
            data: {
              name: typeof body.name === 'string' ? body.name.trim() : undefined,
              vehicleType: body.vehicleType !== undefined ? vehicleType : undefined,
              vehicleNumber:
                body.vehicleNumber !== undefined ? vehicleNumber : undefined,
              phone:
                body.phone !== undefined
                  ? normalizeNepalPhone(body.phone) || body.phone
                  : undefined,
            },
          })
        } else {
          await tx.deliveryPartner.create({
            data: {
              userId,
              name: user.name,
              phone: user.phone || `partner-${userId.slice(-8)}`,
              email: user.email,
              vehicleType,
              vehicleNumber,
              isAvailable: false,
            },
          })
        }
      }
    })

    const full = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partnerAccess: true,
        seller: { include: { _count: { select: { products: true } } } },
        deliveryPartner: true,
      },
    })

    return NextResponse.json(full)
  } catch (error) {
    console.error('Admin partners PATCH:', error)
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 })
  }
}
