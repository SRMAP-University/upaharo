import { NextRequest, NextResponse } from 'next/server'
import {
  requirePartnerAdmin,
  resolvePartnerStoreContext,
} from '@/lib/partner-auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const ctx = await resolvePartnerStoreContext(partner, request)
    if (!ctx) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const q = String(request.nextUrl.searchParams.get('q') || '')
      .trim()
      .toLowerCase()

    const users = await prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        orders: { some: { storeId: ctx.store.id } },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            orders: { where: { storeId: ctx.store.id } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        orderCount: u._count.orders,
      }))
    )
  } catch (error) {
    console.error('Partner admin users GET:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
