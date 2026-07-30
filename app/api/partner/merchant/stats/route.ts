import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireMerchant,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'

export async function GET(request: NextRequest) {
  try {
    const partner = await requireMerchant(request)
    if (!partner?.sellerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const seller = await prisma.seller.findUnique({
      where: { id: partner.sellerId },
    })
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    const storeIds = await resolveStoreIdsForPartner(partner.access, request)
    const fullAccess = partner.access.fullAccess
    const productSellerFilter = fullAccess
      ? {}
      : { sellerId: seller.id }
    const orderItemSellerFilter = fullAccess
      ? {}
      : { items: { some: { product: { sellerId: seller.id } } } }

    const totalProducts = await prisma.product.count({
      where: {
        ...productSellerFilter,
        ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
    })

    const activeProducts = await prisma.product.count({
      where: {
        ...productSellerFilter,
        isAvailable: true,
        ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } },
      },
    })

    const orders = await prisma.order.findMany({
      where: {
        ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        ...orderItemSellerFilter,
      },
      include: {
        items: fullAccess
          ? true
          : { where: { product: { sellerId: seller.id } } },
      },
    })

    const totalOrders = orders.length
    const pendingOrders = orders.filter((o) => o.status === 'PENDING').length
    const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED')

    const commissionRate = fullAccess ? 0 : seller.commission / 100

    const totalRevenue = orders.reduce((sum, order) => {
      const sellerItemsTotal = order.items.reduce(
        (itemSum, item) => itemSum + item.price * item.quantity,
        0
      )
      return sum + sellerItemsTotal * (1 - commissionRate)
    }, 0)

    const grossSales = orders.reduce((sum, order) => {
      return (
        sum +
        order.items.reduce(
          (itemSum, item) => itemSum + item.price * item.quantity,
          0
        )
      )
    }, 0)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthOrders = orders.filter(
      (o) => new Date(o.createdAt) >= startOfMonth
    )
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => {
      const sellerItemsTotal = order.items.reduce(
        (itemSum, item) => itemSum + item.price * item.quantity,
        0
      )
      return sum + sellerItemsTotal * (1 - commissionRate)
    }, 0)

    return NextResponse.json({
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      deliveredCount: deliveredOrders.length,
      totalRevenue,
      grossSales,
      thisMonthRevenue,
      commissionPercent: fullAccess ? 0 : seller.commission,
      fullAccess,
    })
  } catch (error) {
    console.error('Partner merchant stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
