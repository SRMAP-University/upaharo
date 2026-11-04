import type { FulfillmentType, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { generateOrderNumber } from '@/lib/utils'
import { normalizeNepalPhone } from '@/lib/phone'
import { activateOrderFulfillment } from '@/lib/order-payment-lifecycle'

export const OFFLINE_CHANNELS = ['WALK_IN', 'PHONE', 'WHATSAPP', 'INSTAGRAM', 'OTHER'] as const
export type OfflineChannel = (typeof OFFLINE_CHANNELS)[number]

export type OfflineOrderItemInput = {
  /** Catalog product; leave empty for a custom item. */
  productId?: string
  quantity: number
  /** Unit price for this order; defaults to the product's shop price. */
  price?: number | null
  /** Custom item name (when there is no catalog product). */
  name?: string
}

/** Tag on the hidden products that hold custom offline-order items. */
export const OFFLINE_CUSTOM_TAG = 'offline-custom'
const CUSTOM_CATEGORY = 'Custom item'

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

type ResolvedLine = { productId: string; quantity: number; price: number }

const roundMoney = (value: number) => Math.round(value * 100) / 100

/**
 * Turns the admin's lines into order items. Any product in the store can be
 * sold offline, inactive ones too (not archived ones); the admin may change
 * the price. Custom items get a hidden product to hang the order line on.
 */
async function resolveOfflineLines(
  storeId: string,
  itemsInput: OfflineOrderItemInput[] | undefined
): Promise<
  | {
      lines: ResolvedLine[]
      products: Array<{ pickupLatitude: number | null; pickupLongitude: number | null; pickupAddress: string | null }>
    }
  | { error: OfflineOrderError }
> {
  const raw = (Array.isArray(itemsInput) ? itemsInput : [])
    .map((item) => {
      const price = item?.price === null || item?.price === undefined || item?.price === ('' as unknown) ? null : Number(item.price)
      return {
        productId: String(item?.productId || '').trim(),
        name: String(item?.name || '').trim().slice(0, 200),
        quantity: Math.max(1, Math.round(Number(item?.quantity) || 0)),
        price: price !== null && Number.isFinite(price) ? price : null,
      }
    })
    .filter((item) => item.productId || item.name)

  if (raw.length === 0) {
    return { error: { status: 400, error: 'Add at least one product' } }
  }
  if (raw.some((item) => item.price !== null && item.price < 0)) {
    return { error: { status: 400, error: 'Prices cannot be negative' } }
  }
  if (raw.some((item) => !item.productId && item.price === null)) {
    return { error: { status: 400, error: 'Give each custom item a price' } }
  }

  const ids = Array.from(new Set(raw.filter((item) => item.productId).map((item) => item.productId)))
  const found = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids }, storeId },
        select: {
          id: true,
          name: true,
          price: true,
          discount: true,
          tags: true,
          pickupLatitude: true,
          pickupLongitude: true,
          pickupAddress: true,
        },
      })
    : []
  const byId = new Map(found.map((product) => [product.id, product]))
  for (const id of ids) {
    const product = byId.get(id)
    // Archived products are gone from the catalog; their own custom items are fine.
    if (!product || (product.tags.includes(ARCHIVED_PRODUCT_TAG) && !product.tags.includes(OFFLINE_CUSTOM_TAG))) {
      return { error: { status: 400, error: 'One or more products no longer exist' } }
    }
  }

  const lines: ResolvedLine[] = []
  for (const item of raw) {
    if (item.productId) {
      const product = byId.get(item.productId)!
      const shopPrice =
        product.discount && product.discount > 0 ? product.price * (1 - product.discount / 100) : product.price
      // Renaming a custom item updates its hidden product.
      if (product.tags.includes(OFFLINE_CUSTOM_TAG) && item.name && item.name !== product.name) {
        await prisma.product.update({ where: { id: product.id }, data: { name: item.name, imageAlt: item.name } })
      }
      lines.push({ productId: product.id, quantity: item.quantity, price: roundMoney(item.price ?? shopPrice) })
      continue
    }
    const custom = await prisma.product.create({
      data: {
        storeId,
        name: item.name,
        description: 'Custom item from an offline order.',
        category: CUSTOM_CATEGORY,
        price: roundMoney(item.price!),
        image: '',
        imageAlt: item.name,
        isAvailable: false,
        // Hidden from the shop and the product list; it only exists for this order line.
        tags: [ARCHIVED_PRODUCT_TAG, OFFLINE_CUSTOM_TAG],
        prepTime: 0,
      },
      select: { id: true },
    })
    lines.push({ productId: custom.id, quantity: item.quantity, price: roundMoney(item.price!) })
  }

  return { lines, products: found }
}

export async function createOfflineOrder(
  input: CreateOfflineOrderInput
): Promise<{ order: unknown } | { error: OfflineOrderError }> {
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

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: { status: 400, error: 'Add at least one product' } }
  }
  const resolved = await resolveOfflineLines(input.storeId, input.items)
  if ('error' in resolved) return { error: resolved.error }
  const { lines, products } = resolved

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

const ORDER_INCLUDE = {
  user: { select: { name: true, email: true, phone: true } },
  address: true,
  items: {
    include: {
      product: { select: { id: true, name: true, image: true, tags: true, price: true, discount: true } },
    },
  },
  store: { select: { id: true, slug: true, name: true } },
} as const

/** An offline order with what the edit form needs. */
export async function getOfflineOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId, source: 'OFFLINE' },
    include: ORDER_INCLUDE,
  })
  if (!order) return null
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      isCustom: item.product.tags.includes(OFFLINE_CUSTOM_TAG),
    })),
  }
}

/**
 * Saves changes to an offline order: its items (catalog, inactive or custom,
 * at any price), customer, delivery or pickup, fees and payment. The order
 * keeps its number and status unless a new status is given.
 */
export async function updateOfflineOrder(
  orderId: string,
  input: CreateOfflineOrderInput
): Promise<{ order: unknown } | { error: OfflineOrderError }> {
  const existing = await prisma.order.findFirst({
    where: { id: orderId, storeId: input.storeId, source: 'OFFLINE' },
    select: { id: true, userId: true, addressId: true, status: true, user: { select: { phone: true, email: true } } },
  })
  if (!existing) {
    return { error: { status: 404, error: 'Offline order not found' } }
  }

  const channel = parseOfflineChannel(input.channel)
  const fulfillmentType: FulfillmentType = input.fulfillmentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP'
  const paymentMethod: PaymentMethod =
    input.paymentMethod === 'ONLINE' || input.paymentMethod === 'CARD' ? input.paymentMethod : 'CASH'
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
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { error: { status: 400, error: 'Add at least one product' } }
  }

  const resolved = await resolveOfflineLines(input.storeId, input.items)
  if ('error' in resolved) return { error: resolved.error }
  const { lines, products } = resolved

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const discount = Math.min(Math.max(0, Number(input.discount) || 0), subtotal)
  const deliveryFee = fulfillmentType === 'PICKUP' ? 0 : Math.max(0, Number(input.deliveryFee) || 0)
  const total = Math.max(0, subtotal - discount + deliveryFee)

  // A different phone number means a different customer.
  let userId = existing.userId
  if (phone && phone !== existing.user?.phone) {
    const customer = await findOrCreateOfflineCustomer({ storeId: input.storeId, name: input.customerName, phone })
    userId = customer.id
  } else if (String(input.customerName || '').trim() && existing.user?.email?.endsWith('@upaharo.internal')) {
    // Only rename customers the shop created for offline orders, never real accounts.
    await prisma.user.update({ where: { id: existing.userId }, data: { name: String(input.customerName).trim() } })
  }

  let addressId: string | null = null
  if (fulfillmentType === 'DELIVERY' && input.address) {
    const addressData = {
      street: String(input.address.street).trim(),
      apartment: input.address.apartment?.trim() || null,
      landmark: input.address.landmark?.trim() || null,
      city: String(input.address.city).trim(),
      state: String(input.address.state || 'Bagmati').trim() || 'Bagmati',
      pincode: String(input.address.pincode || '44600').trim() || '44600',
    }
    const reuse = existing.addressId && userId === existing.userId
    if (reuse) {
      await prisma.address.update({ where: { id: existing.addressId! }, data: addressData })
      addressId = existing.addressId
    } else {
      const created = await prisma.address.create({
        data: {
          ...addressData,
          userId,
          label: 'Offline',
          latitude: Number(input.address.latitude) || 27.7172,
          longitude: Number(input.address.longitude) || 85.324,
          isDefault: false,
        },
        select: { id: true },
      })
      addressId = created.id
    }
  }

  const firstPickup = products.find(
    (product) => Number.isFinite(product.pickupLatitude) && Number.isFinite(product.pickupLongitude)
  )
  const now = new Date()
  const status = input.status && input.status !== existing.status ? input.status : null

  const order = await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { orderId } })
    return tx.order.update({
      where: { id: orderId },
      data: {
        userId,
        fulfillmentType,
        pickupLatitude: fulfillmentType === 'PICKUP' ? firstPickup?.pickupLatitude ?? null : null,
        pickupLongitude: fulfillmentType === 'PICKUP' ? firstPickup?.pickupLongitude ?? null : null,
        pickupAddress: fulfillmentType === 'PICKUP' ? firstPickup?.pickupAddress ?? 'Store pickup' : null,
        addressId,
        subtotal,
        deliveryFee,
        discount,
        total,
        paymentMethod,
        ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
        offlineChannel: channel,
        offlineNote: String(input.note || '').trim() || null,
        ...(status
          ? {
              status,
              ...(status === 'DELIVERED' ? { deliveredAt: now } : {}),
              ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
            }
          : {}),
        items: {
          create: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, price: line.price })),
        },
      },
      include: ORDER_INCLUDE,
    })
  })

  return { order }
}
