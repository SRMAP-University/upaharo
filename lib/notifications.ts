import { NotificationType, OrderStatus, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendPushToUser, type PushPayload } from '@/lib/push'
import { DEFAULT_STORE_SLUG } from '@/lib/store-constants'
import { getStore } from '@/lib/store-context'

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
  /** Required for correct app targeting (gifts vs grocery). */
  storeId?: string | null
  storeSlug?: string | null
}

type OrderCopy = {
  title: string
  body: (orderNumber: string) => string
}

function orderStatusCopy(storeSlug: string): Record<OrderStatus, OrderCopy> {
  const grocery = storeSlug === 'grocery'
  return {
    PENDING: {
      title: 'Order placed',
      body: (n) =>
        grocery
          ? `We received order #${n}. We'll start packing it soon.`
          : `We received order #${n}. We'll start preparing it soon.`,
    },
    ACCEPTED: {
      title: 'Order accepted',
      body: (n) =>
        grocery
          ? `Order #${n} was accepted and is being packed.`
          : `Order #${n} was accepted and is being handled.`,
    },
    PREPARING: {
      title: grocery ? 'Packing your order' : 'Being prepared',
      body: (n) =>
        grocery
          ? `Your groceries for order #${n} are being packed.`
          : `Your gift for order #${n} is being prepared with care.`,
    },
    READY: {
      title: 'Ready for delivery',
      body: (n) => `Order #${n} is ready and waiting for pickup.`,
    },
    OUT_FOR_DELIVERY: {
      title: 'Out for delivery',
      body: (n) =>
        `Order #${n} is on the way. Share your delivery code when it arrives.`,
    },
    DELIVERED: {
      title: 'Delivered',
      body: (n) =>
        grocery
          ? `Order #${n} was delivered. Enjoy your groceries!`
          : `Order #${n} was delivered. We hope it made someone smile!`,
    },
    CANCELLED: {
      title: 'Order cancelled',
      body: (n) => `Order #${n} was cancelled. Contact support if you need help.`,
    },
  }
}

async function resolveNotifyStore(opts: {
  storeId?: string | null
  storeSlug?: string | null
}): Promise<{ storeId: string; storeSlug: string }> {
  if (opts.storeId) {
    const store = await prisma.store.findUnique({
      where: { id: opts.storeId },
      select: { id: true, slug: true },
    })
    if (store) return { storeId: store.id, storeSlug: store.slug }
  }

  const slug = (opts.storeSlug || DEFAULT_STORE_SLUG).toLowerCase()
  const bySlug = await getStore(slug)
  if (bySlug) return { storeId: bySlug.id, storeSlug: bySlug.slug }

  const fallback = await getStore(DEFAULT_STORE_SLUG)
  if (!fallback) {
    throw new Error('No store available for notifications')
  }
  return { storeId: fallback.id, storeSlug: fallback.slug }
}

export async function notifyUser(opts: NotifyOpts): Promise<{ pushSuccess: number }> {
  const { userId, type, title, body, data, persist = true, push = true } = opts
  let pushSuccess = 0

  const { storeId, storeSlug } = await resolveNotifyStore(opts)
  const enrichedData: Record<string, string> = {
    ...(data || {}),
    storeSlug,
    storeId,
  }

  if (persist) {
    try {
      await prisma.appNotification.create({
        data: {
          userId,
          storeId,
          type,
          title,
          body,
          data: enrichedData,
        },
      })
    } catch (error) {
      console.error('[notifications] Failed to persist:', error)
    }
  }

  if (push) {
    const payload: PushPayload = {
      title,
      body,
      data: enrichedData,
      storeSlug,
    }
    try {
      pushSuccess = await sendPushToUser(userId, payload, storeId)
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
  storeId?: string | null
  storeSlug?: string | null
}) {
  const { storeSlug } = await resolveNotifyStore(params)
  const copy = orderStatusCopy(storeSlug).PENDING
  await notifyUser({
    userId: params.userId,
    storeId: params.storeId,
    storeSlug,
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
  storeId?: string | null
  storeSlug?: string | null
}) {
  const { storeSlug } = await resolveNotifyStore(params)
  const copy = orderStatusCopy(storeSlug)[params.status] || {
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
    storeId: params.storeId,
    storeSlug,
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
  storeId?: string | null
  storeSlug?: string | null
}) {
  const ok = params.paymentStatus === 'COMPLETED'
  const failed = params.paymentStatus === 'FAILED'
  if (!ok && !failed) return

  const label = params.orderNumber ? `#${params.orderNumber}` : ''
  await notifyUser({
    userId: params.userId,
    storeId: params.storeId,
    storeSlug: params.storeSlug,
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
  storeId?: string | null
  storeSlug?: string | null
}) {
  await notifyUser({
    userId: params.userId,
    storeId: params.storeId,
    storeSlug: params.storeSlug || 'gifts',
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
  storeId?: string | null
  storeSlug?: string | null
}) {
  return notifyUser({
    userId: params.userId,
    storeId: params.storeId,
    storeSlug: params.storeSlug,
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
