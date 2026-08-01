import { NextRequest, NextResponse } from 'next/server'
import { requireMerchant } from '@/lib/partner-auth'
import { digitalBillUrl } from '@/lib/digital-bill'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Signed customer invoice URL for thermal QR (HTML tax invoice). */
export async function GET(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orderNumber = String(
      request.nextUrl.searchParams.get('orderNumber') || ''
    ).trim()
    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber required' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true, orderNumber: true, storeId: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      digitalBillUrl: digitalBillUrl(order.orderNumber),
    })
  } catch (error) {
    console.error('Partner bill-url GET:', error)
    return NextResponse.json({ error: 'Failed to build bill URL' }, { status: 500 })
  }
}
