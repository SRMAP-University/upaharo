import { NotificationType, OrderStatus, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  PARTNER_NEW_ORDER_CHANNEL,
  PARTNER_NEW_ORDER_SOUND,
  sendPushToTokens,
  sendPushToUser,
  type PushPayload,
} from '@/lib/push'
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
  androidChannelId?: string
  sound?: string
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
      androidChannelId: opts.androidChannelId,
      sound: opts.sound,
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

/**
 * Loud push to every seller whose products are on this order.
 * Called after payment is real (COD / wallet / Stripe completed).
 */
export async function notifyPartnerSellersNewOrder(params: {
  orderId: string
  orderNumber: string
  storeId?: string | null
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderNumber: true,
      storeId: true,
      total: true,
      items: {
        select: {
          quantity: true,
          product: {
            select: {
              name: true,
              sellerId: true,
              seller: {
                select: {
                  id: true,
                  userId: true,
                  isActive: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
      store: { select: { id: true, slug: true } },
    },
  })

  if (!order) return

  const storeId = order.storeId || params.storeId || order.store?.id
  const storeSlug = order.store?.slug || undefined

  type SellerBucket = {
    userId: string
    businessName: string
    itemCount: number
    names: string[]
  }
  const bySeller = new Map<string, SellerBucket>()

  for (const item of order.items) {
    const seller = item.product?.seller
    if (!seller?.userId || !seller.isActive) continue
    const qty = item.quantity || 1
    const existing = bySeller.get(seller.userId)
    const name = item.product?.name || 'Item'
    if (existing) {
      existing.itemCount += qty
      if (existing.names.length < 3) existing.names.push(name)
    } else {
      bySeller.set(seller.userId, {
        userId: seller.userId,
        businessName: seller.businessName || 'Shop',
        itemCount: qty,
        names: [name],
      })
    }
  }

  await Promise.all(
    [...bySeller.values()].map(async (seller) => {
      const preview = seller.names.join(', ')
      const more =
        seller.itemCount > seller.names.length
          ? ` +${seller.itemCount - seller.names.length} more`
          : ''
      try {
        await notifyUser({
          userId: seller.userId,
          storeId,
          storeSlug,
          type: 'ORDER_PLACED',
          persist: false,
          title: `New order #${order.orderNumber}`,
          body: `${seller.itemCount} item(s): ${preview}${more}`,
          androidChannelId: PARTNER_NEW_ORDER_CHANNEL,
          sound: PARTNER_NEW_ORDER_SOUND,
          data: {
            type: 'PARTNER_NEW_ORDER',
            orderId: order.id,
            orderNumber: order.orderNumber,
            route: 'merchant-orders',
            audience: 'partner',
          },
        })
      } catch (err) {
        console.error('[notifications] Partner seller push failed:', err)
      }
    })
  )
}

/**
 * Loud push to online delivery partners when an order enters the READY pool.
 */
export async function notifyDeliveryPartnersJobAvailable(params: {
  orderId: string
  orderNumber: string
  storeId?: string | null
  /** Seller/admin who marked READY — do not push to their own partner app. */
  excludeUserId?: string | null
}): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      orderNumber: true,
      storeId: true,
      total: true,
      deliveryFee: true,
      deliveryPartnerId: true,
      store: { select: { id: true, slug: true, name: true } },
      address: { select: { street: true, city: true } },
    },
  })
  if (!order || order.deliveryPartnerId) return

  const storeId = order.storeId || params.storeId || order.store?.id
  if (!storeId) return

  const online = await prisma.deliveryPartner.findMany({
    where: { isAvailable: true, userId: { not: null } },
    select: { userId: true },
  })
  const exclude = params.excludeUserId || null
  const userIds = [
    ...new Set(
      online
        .map((d) => d.userId)
        .filter((id): id is string => Boolean(id) && id !== exclude)
    ),
  ]
  if (!userIds.length) return

  const devices = await prisma.deviceToken.findMany({
    where: {
      userId: { in: userIds },
      storeId,
      clientApp: 'partner',
    },
    select: { token: true },
  })
  if (!devices.length) return

  const where = [order.address?.street, order.address?.city]
    .filter(Boolean)
    .join(', ')
  const fee = order.deliveryFee != null ? ` · fee Rs ${Math.round(Number(order.deliveryFee))}` : ''

  try {
    await sendPushToTokens(
      devices.map((d) => d.token),
      {
        title: `Delivery job #${order.orderNumber}`,
        body: `${order.store?.name || 'Order'}${fee}${where ? ` · ${where}` : ''}`,
        storeSlug: order.store?.slug,
        androidChannelId: PARTNER_NEW_ORDER_CHANNEL,
        sound: PARTNER_NEW_ORDER_SOUND,
        data: {
          type: 'PARTNER_DELIVERY_JOB',
          orderId: order.id,
          orderNumber: order.orderNumber,
          route: 'delivery-pool',
          audience: 'partner',
          storeSlug: order.store?.slug || '',
        },
      }
    )
  } catch (err) {
    console.error('[notifications] Delivery pool push failed:', err)
  }
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
