/**
 * The order shape the admin Orders page shows: customer, address, gift
 * details, coupon code, and each item with its product (for photo, link and
 * offer price). Shared by the order list and by order updates, so the order
 * window keeps everything after a status or payment change.
 */
import type { Prisma } from '@prisma/client'
import { OFFLINE_CUSTOM_TAG } from '@/lib/offline-order'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

export const ADMIN_ORDER_INCLUDE = {
  store: { select: { slug: true, name: true } },
  user: { select: { name: true, email: true, phone: true } },
  address: {
    select: {
      label: true,
      street: true,
      apartment: true,
      landmark: true,
      city: true,
      state: true,
      pincode: true,
      latitude: true,
      longitude: true,
    },
  },
  deliveryPartner: {
    select: { id: true, name: true, phone: true, vehicleType: true, vehicleNumber: true },
  },
  recipient: { select: { name: true, phone: true, relationship: true } },
  occasion: { select: { name: true, emoji: true } },
  giftWrap: { select: { name: true, type: true, price: true, image: true } },
  coupon: { select: { code: true, description: true, type: true, value: true, maxDiscount: true, minOrderAmount: true } },
  items: {
    include: {
      product: {
        select: { id: true, name: true, image: true, price: true, discount: true, tags: true },
      },
    },
  },
} satisfies Prisma.OrderInclude

type AdminOrderRow = Prisma.OrderGetPayload<{ include: typeof ADMIN_ORDER_INCLUDE }>

/**
 * Says whether each item still has a page in the shop (custom lines from
 * offline orders and deleted products don't); the tags themselves stay here.
 */
export function toAdminOrder(order: AdminOrderRow) {
  return {
    ...order,
    items: order.items.map((item) => {
      const { tags, ...product } = item.product
      return {
        ...item,
        product: {
          ...product,
          custom: tags.includes(OFFLINE_CUSTOM_TAG),
          inShop: !tags.includes(ARCHIVED_PRODUCT_TAG),
        },
      }
    }),
  }
}
