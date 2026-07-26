import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { retrieveDodoPayment } from '@/lib/dodo-payments'

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = String(body.orderId || '')
    const paymentId = String(body.paymentId || '')
    const fallbackStatus = String(body.status || '')

    if (!orderId || !paymentId) {
      return NextResponse.json({ error: 'Missing orderId or paymentId' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.paymentMethod !== 'ONLINE') {
      return NextResponse.json({ error: 'Order is not an online payment' }, { status: 400 })
    }

    const payment = await retrieveDodoPayment(paymentId)
    const providerStatus = payment.status || fallbackStatus
    const expectedAmount = Math.round(Number(order.total) * 100)
    const metadataOrderId =
      payment.metadata && typeof payment.metadata.orderId === 'string'
        ? payment.metadata.orderId
        : null

    if (metadataOrderId && metadataOrderId !== orderId) {
      return NextResponse.json({ error: 'Payment does not belong to this order' }, { status: 400 })
    }

    if (payment.total_amount !== expectedAmount) {
      return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 })
    }

    const normalizedStatus =
      providerStatus === 'succeeded'
        ? 'COMPLETED'
        : providerStatus === 'failed' || providerStatus === 'cancelled'
          ? 'FAILED'
          : 'PENDING'

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: normalizedStatus,
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        userId: true,
      },
    })

    if (
      normalizedStatus !== order.paymentStatus &&
      (normalizedStatus === 'COMPLETED' || normalizedStatus === 'FAILED')
    ) {
      void import('@/lib/notifications').then(({ notifyPaymentUpdate }) =>
        notifyPaymentUpdate({
          userId: updatedOrder.userId,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          paymentStatus: normalizedStatus,
        }).catch((err) => console.error('Payment notification failed:', err))
      )
    }

    return NextResponse.json({
      orderId: updatedOrder.id,
      paymentStatus: updatedOrder.paymentStatus,
    })
  } catch (error: any) {
    console.error('Error confirming Dodo payment:', error)
    return NextResponse.json(
      { error: 'Failed to confirm Dodo payment', details: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
