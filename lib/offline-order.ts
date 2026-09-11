import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { generateOrderNumber } from '@/lib/utils'
import { normalizeNepalPhone } from '@/lib/phone'
import { activateOrderFulfillment } from '@/lib/order-payment-lifecycle'

export const OFFLINE_CHANNELS = ['WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'OTHER'] as const
export type OfflineChannel = (typeof OFFLINE_CHANNELS)[number]

export type OfflineOrderItemInput = {
  productId: string
  quantity: number
}

export type OfflineAddressInput = {
  street: string
  apartment?: string
  landmark?: string
  city: string
  state?: string
  pincode?: string
  latitude?: number
  longitude?: number
}

export type CreateOfflineOrderInput = {
  storeId: string
  storeSlug: string
  items: OfflineOrderItemInput[]
  customerName?: string
  customerPhone?: string
  channel?: OfflineChannel
  fulfillmentType?: FulfillmentType
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  status?: OrderStatus
  discount?: number
  deliveryFee?: number
  estimatedTime?: number
  note?: string
  address?: OfflineAddressInput | null
}

export type OfflineOrderError = {
  status: number
  error: string
}

function isChannel(value: unknown): value is OfflineChannel {
  return OFFLINE_CHANNELS.includes(String(value || '') as OfflineChannel)
}

export function parseOfflineChannel(value: unknown): OfflineChannel {
  return isChannel(value) ? value : 'WALK_IN'
}

async function findOrCreateOfflineCustomer(input: {
  storeId: string
  name?: string
  phone?: string | null
}) {
  const phone = input.phone ? normalizeNepalPhone(input.phone) : null
  const name = String(input.name || '').trim() || (phone ? `Customer ${phone.slice(-4)}` : 'Walk-in customer')

  if (phone) {
    const existing = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, email: true },
    })
    if (existing) {
      if (name && existing.name === 'Walk-in customer') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { name },
        })
      }
      return existing
    }

    return prisma.user.create({
      data: {
        name,
        phone,
        email: `offline.${phone}@upaharo.internal`,
        role: 'CUSTOMER',
        password: null,
      },
      select: { id: true, name: true, phone: true, email: true },
    })
  }

  const walkInEmail = `walkin.${input.storeId}@upaharo.internal`
  const existing = await prisma.user.findUnique({
    where: { email: walkInEmail },
    select: { id: true, name: true, phone: true, email: true },
  })
  if (existing) return existing

  return prisma.user.create({
    data: {
      name: name || 'Walk-in customer',
      email: walkInEmail,
      role: 'CUSTOMER',
      password: null,
    },
    select: { id: true, name: true, phone: true, email: true },
  })
}

export async function createOfflineOrder(
  input: CreateOfflineOrderInput
): Promise<{ order: unknown } | { error: OfflineOrderError }> {
  const itemsInput = Array.isArray(input.items) ? input.items : []
  const cleaned = itemsInput
    .map((item) => ({
      productId: String(item?.productId || '').trim(),
      quantity: Math.max(1, Math.round(Number(item?.quantity) || 0)),
    }))
    .filter((item) => item.productId && item.quantity > 0)

  if (cleaned.length === 0) {
    return { error: { status: 400, error: 'Add at least one product' } }
  }

  const channel = parseOfflineChannel(input.channel)
  const fulfillmentType: FulfillmentType =
    input.fulfillmentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'
  const paymentMethod: PaymentMethod =
    input.paymentMethod === 'ONLINE' || input.paymentMethod === 'CARD'
      ? input.paymentMethod
      : 'CASH'
  const phone = input.customerPhone ? normalizeNepalPhone(input.customerPhone) : null

  if ((channel === 'PHONE' || channel === 'WHATSAPP') && !phone) {
    return { error: { status: 400, error: 'Enter a valid Nepal mobile number' } }
  }

  if (fulfillmentType === 'DELIVERY') {
    const street = String(input.address?.street || '').trim()
    const city = String(input.address?.city || '').trim()
    if (!street || !city) {
      return { error: { status: 400, error: 'Delivery address is required' } }
    }
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: cleaned.map((item) => item.productId) },
      storeId: input.storeId,
      isAvailable: true,
      NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
    },
    select: {
      id: true,
      name: true,
      price: true,
      discount: true,
      pickupLatitude: true,
      pickupLongitude: true,
      pickupAddress: true,
    },
  })

  if (products.length !== cleaned.length) {
    return { error: { status: 400, error: 'One or more products are unavailable' } }
  }

  const byId = new Map(products.map((product) => [product.id, product]))
  const lines = cleaned.map((item) => {
    const product = byId.get(item.productId)!
    const catalogPrice =
      product.discount && product.discount > 0
        ? product.price * (1 - product.discount / 100)
        : product.price
    return {
      productId: product.id,
      quantity: item.quantity,
      price: Math.round(catalogPrice * 100) / 100,
    }
  })

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const discount = Math.min(Math.max(0, Number(input.discount) || 0), subtotal)
  const deliveryFee =
    fulfillmentType === 'PICKUP' ? 0 : Math.max(0, Number(input.deliveryFee) || 0)
  const total = Math.max(0, subtotal - discount + deliveryFee)

  const defaultWalkIn = channel === 'WALK_IN' && fulfillmentType === 'PICKUP'
  const status: OrderStatus =
    input.status || (defaultWalkIn ? 'DELIVERED' : 'ACCEPTED')
  const paymentStatus: PaymentStatus =
    input.paymentStatus ||
    (defaultWalkIn || paymentMethod !== 'CASH' ? 'COMPLETED' : 'PENDING')
  const now = new Date()
  const estimatedTime =
    Number.isFinite(Number(input.estimatedTime)) && Number(input.estimatedTime) >= 0
      ? Math.round(Number(input.estimatedTime))
      : defaultWalkIn
        ? 0
        : 45

  const customer = await findOrCreateOfflineCustomer({
    storeId: input.storeId,
    name: input.customerName,
    phone,
  })

  let addressId: string | null = null
  if (fulfillmentType === 'DELIVERY' && input.address) {
    const createdAddress = await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Offline',
        street: String(input.address.street).trim(),
        apartment: input.address.apartment?.trim() || null,
        landmark: input.address.landmark?.trim() || null,
        city: String(input.address.city).trim(),
        state: String(input.address.state || 'Bagmati').trim() || 'Bagmati',
        pincode: String(input.address.pincode || '44600').trim() || '44600',
        latitude: Number(input.address.latitude) || 27.7172,
        longitude: Number(input.address.longitude) || 85.324,
        isDefault: false,
      },
      select: { id: true },
    })
    addressId = createdAddress.id
  }

  const firstPickup = products.find(
    (product) =>
      Number.isFinite(product.pickupLatitude) && Number.isFinite(product.pickupLongitude)
  )

  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(input.storeSlug),
      storeId: input.storeId,
      userId: customer.id,
      status,
      fulfillmentType,
      pickupLatitude: fulfillmentType === 'PICKUP' ? firstPickup?.pickupLatitude ?? null : null,
      pickupLongitude: fulfillmentType === 'PICKUP' ? firstPickup?.pickupLongitude ?? null : null,
      pickupAddress: fulfillmentType === 'PICKUP' ? firstPickup?.pickupAddress ?? 'Store pickup' : null,
      addressId,
      subtotal,
      deliveryFee,
      tax: 0,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      estimatedTime,
      source: 'OFFLINE',
      offlineChannel: channel,
      offlineNote: String(input.note || '').trim() || null,
      acceptedAt: status !== 'PENDING' && status !== 'CANCELLED' ? now : null,
      deliveredAt: status === 'DELIVERED' ? now : null,
      cancelledAt: status === 'CANCELLED' ? now : null,
      items: {
        create: lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          price: line.price,
        })),
      },
    },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      address: true,
      items: {
        include: {
          product: { select: { id: true, name: true, image: true } },
        },
      },
      store: { select: { id: true, slug: true, name: true } },
    },
  })

  await activateOrderFulfillment({
    id: order.id,
    userId: order.userId,
    orderNumber: order.orderNumber,
    storeId: order.storeId,
  })

  return { order }
}
