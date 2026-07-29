import { prisma } from '@/lib/prisma'
import {
  mapStripeSessionToPaymentStatus,
  retrieveStripeCheckoutSession,
} from '@/lib/stripe'
import {
  abandonUnpaidOnlineOrder,
  activateOrderFulfillment,
} from '@/lib/order-payment-lifecycle'
import { createPendingCashback, redeemWallet } from '@/lib/wallet'

type ApplyResult = {
  orderId: string
  orderNumber: string
  userId: string
  paymentStatus: 'COMPLETED' | 'FAILED' | 'PENDING'
  previousStatus: string
}

export async function applyStripeCheckoutSessionToOrder(params: {
  orderId: string
  sessionId: string
  expectedUserId?: string
}): Promise<ApplyResult> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      storeId: true,
      total: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      couponId: true,
      walletDiscount: true,
      walletDebited: true,
      cashbackAmount: true,
      cashbackStatus: true,
    },
  })

  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  if (params.expectedUserId && order.userId !== params.expectedUserId) {
    throw Object.assign(new Error('Unauthorized'), { status: 403 })
  }

  if (order.paymentMethod !== 'ONLINE') {
    throw Object.assign(new Error('Order is not an online payment'), { status: 400 })
  }

  const session = await retrieveStripeCheckoutSession(params.sessionId)
  const metadataOrderId =
    typeof session.metadata?.orderId === 'string' ? session.metadata.orderId : null
  const referenceOrderId = session.client_reference_id || null

  if (
    (metadataOrderId && metadataOrderId !== order.id) ||
    (referenceOrderId && referenceOrderId !== order.id)
  ) {
    throw Object.assign(new Error('Payment does not belong to this order'), {
      status: 400,
    })
  }

  if (typeof session.amount_total === 'number') {
    const expectedAmount = Math.round(Number(order.total) * 100)
    if (session.amount_total !== expectedAmount) {
      throw Object.assign(new Error('Payment amount mismatch'), { status: 400 })
    }
  }

  const normalizedStatus = mapStripeSessionToPaymentStatus(session)

  // Don't downgrade a completed payment if a later event is still pending.
  if (order.paymentStatus === 'COMPLETED' && normalizedStatus !== 'COMPLETED') {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      paymentStatus: 'COMPLETED',
      previousStatus: order.paymentStatus,
    }
  }

  if (normalizedStatus === 'FAILED') {
    await abandonUnpaidOnlineOrder(order.id)
    void import('@/lib/notifications').then(({ notifyPaymentUpdate }) =>
      notifyPaymentUpdate({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: 'FAILED',
        storeId: order.storeId,
      }).catch((err) => console.error('Payment notification failed:', err))
    )
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      paymentStatus: 'FAILED',
      previousStatus: order.paymentStatus,
    }
  }

  if (normalizedStatus === 'PENDING') {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      paymentStatus: 'PENDING',
      previousStatus: order.paymentStatus,
    }
  }

  // COMPLETED — mark paid, then release to fulfillment (once).
  const wasAlreadyPaid = order.paymentStatus === 'COMPLETED'
  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'COMPLETED',
      // If user abandoned then somehow paid, reopen as PENDING for kitchen.
      ...(order.status === 'CANCELLED' ? { status: 'PENDING', cancelledAt: null } : {}),
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      userId: true,
      couponId: true,
    },
  })

  if (!wasAlreadyPaid) {
    // An earlier abandon released the wallet hold and cashback; paying later
    // has to put both back before the order goes to the kitchen.
    if (order.walletDiscount > 0 && !order.walletDebited) {
      try {
        await redeemWallet({
          userId: order.userId,
          storeId: order.storeId,
          orderId: order.id,
          amount: order.walletDiscount,
        })
      } catch (err) {
        console.error('Could not re-apply wallet after late payment:', err)
      }
    }

    if (order.cashbackAmount > 0 && order.cashbackStatus !== 'PENDING') {
      try {
        await createPendingCashback({
          userId: order.userId,
          storeId: order.storeId,
          orderId: order.id,
          amount: order.cashbackAmount,
        })
        await prisma.order.update({
          where: { id: order.id },
          data: { cashbackStatus: 'PENDING' },
        })
      } catch (err) {
        console.error('Could not restore pending cashback after late payment:', err)
      }
    }

    await activateOrderFulfillment({
      id: updatedOrder.id,
      userId: updatedOrder.userId,
      orderNumber: updatedOrder.orderNumber,
      couponId: updatedOrder.couponId,
      storeId: order.storeId,
    })

    void import('@/lib/notifications').then(({ notifyPaymentUpdate }) =>
      notifyPaymentUpdate({
        userId: updatedOrder.userId,
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        paymentStatus: 'COMPLETED',
        storeId: order.storeId,
      }).catch((err) => console.error('Payment notification failed:', err))
    )
  }

  return {
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.orderNumber,
    userId: updatedOrder.userId,
    paymentStatus: 'COMPLETED',
    previousStatus: order.paymentStatus,
  }
}
