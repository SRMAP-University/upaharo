import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { normalizeNepalPhone } from '@/lib/phone'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const partners = await prisma.user.findMany({
      where: {
        OR: [
          { partnerAccess: { isNot: null } },
          { seller: { isNot: null } },
          { deliveryPartner: { isNot: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        partnerAccess: true,
        seller: {
          select: {
            id: true,
            businessName: true,
            businessAddress: true,
            gstin: true,
            commission: true,
            isActive: true,
            isVerified: true,
            phone: true,
            email: true,
            bankAccountName: true,
            bankAccountNo: true,
            ifscCode: true,
            panNumber: true,
            _count: { select: { products: true } },
          },
        },
        deliveryPartner: {
          select: {
            id: true,
            vehicleType: true,
            vehicleNumber: true,
            isAvailable: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Backfill PartnerAccess for legacy sellers / delivery rows
    for (const p of partners) {
      if (p.partnerAccess) continue
      if (!p.seller && !p.deliveryPartner) continue
      await prisma.partnerAccess.create({
        data: {
          userId: p.id,
          sellerEnabled: Boolean(p.seller),
          deliveryEnabled: Boolean(p.deliveryPartner),
          giftsEnabled: true,
          groceryEnabled: false,
        },
      })
      p.partnerAccess = {
        id: '',
        userId: p.id,
        sellerEnabled: Boolean(p.seller),
        deliveryEnabled: Boolean(p.deliveryPartner),
        giftsEnabled: true,
        groceryEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }

    return NextResponse.json(partners)
  } catch (error) {
    console.error('Admin partners GET:', error)
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const phone = normalizeNepalPhone(body.phone)
    const sellerEnabled = Boolean(body.sellerEnabled)
    const deliveryEnabled = Boolean(body.deliveryEnabled)
    const giftsEnabled = body.giftsEnabled !== false
    const groceryEnabled = Boolean(body.groceryEnabled)

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: 'Name, email, and phone are required' },
        { status: 400 }
      )
    }

    if (!sellerEnabled && !deliveryEnabled) {
      return NextResponse.json(
        { error: 'Enable at least Merchant or Delivery' },
        { status: 400 }
      )
    }

    if (!giftsEnabled && !groceryEnabled) {
      return NextResponse.json(
        { error: 'Enable at least one store (Upaharo or Grooll)' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'User with this email or phone already exists' },
        { status: 400 }
      )
    }

    const role = sellerEnabled ? 'SELLER' : 'DELIVERY_PARTNER'

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          phone,
          role,
        },
      })

      await tx.partnerAccess.create({
        data: {
          userId: created.id,
          sellerEnabled,
          deliveryEnabled,
          giftsEnabled,
          groceryEnabled,
        },
      })

      if (sellerEnabled) {
        await tx.seller.create({
          data: {
            userId: created.id,
            businessName: String(body.businessName || name).trim(),
            businessAddress: String(body.businessAddress || '').trim() || '—',
            gstin: body.gstin || undefined,
            phone,
            email,
            commission: Number(body.commission) || 15,
            bankAccountName: body.bankAccountName || undefined,
            bankAccountNo: body.bankAccountNo || undefined,
            ifscCode: body.ifscCode || undefined,
            panNumber: body.panNumber || undefined,
            isActive: true,
            isVerified: Boolean(body.isVerified),
          },
        })
      }

      if (deliveryEnabled) {
        await tx.deliveryPartner.create({
          data: {
            userId: created.id,
            name,
            phone,
            email,
            vehicleType: String(body.vehicleType || 'bike'),
            vehicleNumber: String(body.vehicleNumber || ''),
            isAvailable: false,
          },
        })
      }

      return created
    })

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        partnerAccess: true,
        seller: true,
        deliveryPartner: true,
      },
    })

    return NextResponse.json(full, { status: 201 })
  } catch (error) {
    console.error('Admin partners POST:', error)
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
  }
}
