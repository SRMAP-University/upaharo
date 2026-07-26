import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/request-auth'
import { prisma } from '@/lib/prisma'
import { abandonUnpaidOnlineOrder } from '@/lib/order-payment-lifecycle'

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = String(body.orderId || '')
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, paymentMethod: true },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.paymentMethod !== 'ONLINE') {
      return NextResponse.json({ error: 'Not an online payment order' }, { status: 400 })
    }

    const result = await abandonUnpaidOnlineOrder(orderId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error cancelling Stripe checkout order:', error)
    return NextResponse.json(
      { error: 'Failed to cancel unpaid order', details: error?.message },
      { status: 500 }
    )
  }
}
