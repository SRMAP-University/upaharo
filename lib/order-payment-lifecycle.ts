import { prisma } from '@/lib/prisma'
import { redis, REDIS_CHANNELS } from '@/lib/redis'
import { refundRedeem, voidPendingCashback } from '@/lib/wallet'

/** True when an ONLINE order is still waiting on Stripe (not yet a real order). */
export function isAwaitingOnlinePayment(order: {
  paymentMethod: string
  paymentStatus: string
  status: string
}): boolean {
  return (
    order.paymentMethod === 'ONLINE' &&
    order.paymentStatus === 'PENDING' &&
    order.status !== 'CANCELLED'
  )
}

/** Publish + notify kitchen/customer only after payment is confirmed (or COD). */
export async function activateOrderFulfillment(order: {
  id: string
  userId: string
  orderNumber: string
  storeId?: string | null
  couponId?: string | null
}): Promise<void> {
  if (order.couponId) {
    try {
      await prisma.coupon.update({
        where: { id: order.couponId },
        data: { usedCount: { increment: 1 } },
      })
    } catch (err) {
      console.warn('Failed to increment coupon after payment:', err)
    }
  }

  try {
    await redis.publish(
      REDIS_CHANNELS.ORDER_UPDATES,
      JSON.stringify({
        orderId: order.id,
        status: 'PENDING',
        timestamp: new Date().toISOString(),
      })
    )
  } catch (redisError) {
    console.warn('Redis publish failed (non-critical):', redisError)
  }

  void import('@/lib/notifications').then(async ({ notifyOrderPlaced, notifyPartnerSellersNewOrder }) => {
    try {
      await notifyOrderPlaced({
        userId: order.userId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
      })
    } catch (err) {
      console.error('Order placed notification failed:', err)
    }
    try {
      await notifyPartnerSellersNewOrder({
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
      })
    } catch (err) {
      console.error('Partner seller new-order push failed:', err)
    }
  })
}

/** Cancel an unpaid ONLINE order so it never reaches fulfillment. */
export async function abandonUnpaidOnlineOrder(orderId: string): Promise<{
  abandoned: boolean
  orderId: string
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
    },
  })

  if (!order) {
    throw Object.assign(new Error('Order not found'), { status: 404 })
  }

  if (order.paymentMethod !== 'ONLINE') {
    return { abandoned: false, orderId: order.id }
  }

  if (order.paymentStatus === 'COMPLETED') {
    return { abandoned: false, orderId: order.id }
  }

  if (order.status === 'CANCELLED' && order.paymentStatus === 'FAILED') {
    return { abandoned: false, orderId: order.id }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
      cancelledAt: new Date(),
    },
  })

  await releaseOrderWallet(order.id)

  return { abandoned: true, orderId: order.id }
}

/**
 * Give back any wallet hold and drop pending cashback for an order that will
 * never be fulfilled. Safe to call more than once.
 */
export async function releaseOrderWallet(orderId: string): Promise<void> {
  try {
    await refundRedeem(orderId)
  } catch (err) {
    console.error('Failed to refund wallet for order', orderId, err)
  }

  try {
    await voidPendingCashback(orderId)
  } catch (err) {
    console.error('Failed to void pending cashback for order', orderId, err)
  }
}
