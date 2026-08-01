import { NextRequest, NextResponse } from 'next/server'
import { requirePartnerAdmin } from '@/lib/partner-auth'
import { prisma } from '@/lib/prisma'

/** List riders for order assignment (fullAccess). */
export async function GET(request: NextRequest) {
  try {
    const partner = await requirePartnerAdmin(request)
    if (!partner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const riders = await prisma.deliveryPartner.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        isAvailable: true,
      },
      orderBy: { name: 'asc' },
      take: 100,
    })

    return NextResponse.json(riders)
  } catch (error) {
    console.error('Partner admin delivery-partners GET:', error)
    return NextResponse.json({ error: 'Failed to fetch riders' }, { status: 500 })
  }
}
