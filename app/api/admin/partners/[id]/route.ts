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

    const grantAdmin =
      body.grantAdmin !== undefined ? Boolean(body.grantAdmin) : user.role === 'ADMIN'

    // Admin partners get full merchant + delivery in the partner app.
    let sellerEnabled =
      body.sellerEnabled !== undefined
        ? Boolean(body.sellerEnabled)
        : user.partnerAccess?.sellerEnabled ?? Boolean(user.seller)
    let deliveryEnabled =
      body.deliveryEnabled !== undefined
        ? Boolean(body.deliveryEnabled)
        : user.partnerAccess?.deliveryEnabled ?? Boolean(user.deliveryPartner)
    if (grantAdmin) {
      sellerEnabled = true
      deliveryEnabled = true
    }

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

    // Partner app OTP login + admin list use User.phone — keep it in sync.
    let nextPhone: string | undefined
    if (body.phone !== undefined) {
      const normalized = normalizeNepalPhone(body.phone)
      if (!normalized) {
        return NextResponse.json(
          { error: 'Enter a valid Nepal mobile number (98/97…)' },
          { status: 400 }
        )
      }
      if (normalized !== user.phone) {
        const phoneTaken = await prisma.user.findFirst({
          where: { phone: normalized, NOT: { id: userId } },
          select: { id: true },
        })
        if (phoneTaken) {
          return NextResponse.json(
            { error: 'Another user already has this phone number' },
            { status: 400 }
          )
        }
        const deliveryPhoneTaken = await prisma.deliveryPartner.findFirst({
          where: {
            phone: normalized,
            NOT: { userId },
          },
          select: { id: true },
        })
        if (deliveryPhoneTaken) {
          return NextResponse.json(
            { error: 'Another delivery partner already has this phone number' },
            { status: 400 }
          )
        }
      }
      nextPhone = normalized
    }

    await prisma.$transaction(async (tx) => {
      const nextRole = grantAdmin
        ? 'ADMIN'
        : sellerEnabled
          ? 'SELLER'
          : 'DELIVERY_PARTNER'

      await tx.user.update({
        where: { id: userId },
        data: {
          ...(typeof body.name === 'string' && body.name.trim()
            ? { name: body.name.trim() }
            : {}),
          ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
          role: nextRole,
        },
      })

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
          phone: nextPhone,
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
              phone: nextPhone || user.phone || '',
              email: user.email,
              commission: Number(body.commission) || (grantAdmin ? 0 : 15),
              isActive: true,
              isVerified: grantAdmin ? true : Boolean(body.isVerified),
              ...cleaned,
            },
          })
        }

        if (grantAdmin && user.seller) {
          await tx.seller.update({
            where: { userId },
            data: { isActive: true, isVerified: true },
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
              ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
            },
          })
        } else {
          await tx.deliveryPartner.create({
            data: {
              userId,
              name:
                typeof body.name === 'string' && body.name.trim()
                  ? body.name.trim()
                  : user.name,
              phone: nextPhone || user.phone || `partner-${userId.slice(-8)}`,
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
