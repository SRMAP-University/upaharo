import { NotificationType, OrderStatus, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendPushToUser, type PushPayload } from '@/lib/push'

type NotifyOpts = {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
  /** Persist inbox row (default true). */
  persist?: boolean
  /** Send FCM (default true). */
  push?: boolean
}

const ORDER_STATUS_COPY: Record<
  OrderStatus,
  { title: string; body: (orderNumber: string) => string }
> = {
  PENDING: {
    title: 'Order placed',
    body: (n) => `We received order #${n}. We'll start preparing it soon.`,
  },
  ACCEPTED: {
    title: 'Order accepted',
    body: (n) => `Order #${n} was accepted and is being handled.`,
  },
  PREPARING: {
    title: 'Being prepared',
    body: (n) => `Your gift for order #${n} is being prepared with care.`,
  },
  READY: {
    title: 'Ready for delivery',
    body: (n) => `Order #${n} is ready and waiting for pickup.`,
  },
  OUT_FOR_DELIVERY: {
    title: 'Out for delivery',
    body: (n) => `Order #${n} is on the way. Share your delivery code when it arrives.`,
  },
  DELIVERED: {
    title: 'Delivered',
    body: (n) => `Order #${n} was delivered. We hope it made someone smile!`,
  },
  CANCELLED: {
    title: 'Order cancelled',
    body: (n) => `Order #${n} was cancelled. Contact support if you need help.`,
  },
}

export async function notifyUser(opts: NotifyOpts): Promise<{ pushSuccess: number }> {
  const { userId, type, title, body, data, persist = true, push = true } = opts
  let pushSuccess = 0

  if (persist) {
    try {
      await prisma.appNotification.create({
        data: {
          userId,
          type,
          title,
          body,
          data: data || undefined,
        },
      })
    } catch (error) {
      console.error('[notifications] Failed to persist:', error)
    }
  }

  if (push) {
    const payload: PushPayload = { title, body, data }
    try {
      pushSuccess = await sendPushToUser(userId, payload)
    } catch (error) {
      console.error('[notifications] Push failed:', error)
    }
  }

  return { pushSuccess }
}

export async function notifyOrderPlaced(params: {
  userId: string
  orderId: string
  orderNumber: string
}) {
  const copy = ORDER_STATUS_COPY.PENDING
  await notifyUser({
    userId: params.userId,
    type: 'ORDER_PLACED',
    title: copy.title,
    body: copy.body(params.orderNumber),
    data: {
      type: 'ORDER_PLACED',
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      route: 'order-detail',
    },
  })
}

export async function notifyOrderStatus(params: {
  userId: string
  orderId: string
  orderNumber: string
  status: OrderStatus
  deliveryOtp?: string
}) {
  const copy = ORDER_STATUS_COPY[params.status] || {
    title: 'Order update',
    body: (n: string) => `Order #${n} status: ${params.status}`,
  }

  let body = copy.body(params.orderNumber)
  if (
    (params.status === 'OUT_FOR_DELIVERY' || params.status === 'READY') &&
    params.deliveryOtp
  ) {
    body = `Order #${params.orderNumber} update. Your delivery code is ${params.deliveryOtp} — share it only when you receive the order.`
  }

  await notifyUser({
    userId: params.userId,
    type: 'ORDER_UPDATE',
    title: copy.title,
    body,
    data: {
      type: 'ORDER_UPDATE',
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      status: params.status,
      route: 'order-detail',
      ...(params.deliveryOtp ? { deliveryOtp: params.deliveryOtp } : {}),
    },
  })
}

export async function notifyPaymentUpdate(params: {
  userId: string
  orderId: string
  orderNumber?: string
  paymentStatus: PaymentStatus
}) {
  const ok = params.paymentStatus === 'COMPLETED'
  const failed = params.paymentStatus === 'FAILED'
  if (!ok && !failed) return

  const label = params.orderNumber ? `#${params.orderNumber}` : ''
  await notifyUser({
    userId: params.userId,
    type: 'PAYMENT',
    title: ok ? 'Payment successful' : 'Payment failed',
    body: ok
      ? `Payment for order ${label} went through. Thank you!`
      : `Payment for order ${label} failed. Please try again or use another method.`,
    data: {
      type: 'PAYMENT',
      orderId: params.orderId,
      paymentStatus: params.paymentStatus,
      route: 'order-detail',
    },
  })
}

export async function notifyReminder(params: {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}) {
  await notifyUser({
    userId: params.userId,
    type: 'REMINDER',
    title: params.title,
    body: params.body,
    data: {
      type: 'REMINDER',
      ...(params.data || {}),
    },
  })
}

export async function notifyPromo(params: {
  userId: string
  title: string
  body: string
  data?: Record<string, string>
}) {
  return notifyUser({
    userId: params.userId,
    type: 'PROMO',
    title: params.title,
    body: params.body,
    data: {
      type: 'PROMO',
      ...(params.data || {}),
    },
  })
}

/** Status timestamp fields to set when an order moves. */
export function statusTimestampFields(status: OrderStatus): Record<string, Date> {
  const now = new Date()
  switch (status) {
    case 'ACCEPTED':
      return { acceptedAt: now }
    case 'PREPARING':
      return { preparingAt: now }
    case 'OUT_FOR_DELIVERY':
      return { outForDeliveryAt: now }
    case 'DELIVERED':
      return { deliveredAt: now }
    case 'CANCELLED':
      return { cancelledAt: now }
    default:
      return {}
  }
}
