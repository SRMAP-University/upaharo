import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

const DAY_MS = 24 * 60 * 60 * 1000
// Days start at midnight Nepal time (UTC+5:45).
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000
const nepalDayKey = (date: Date) => new Date(date.getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 10)

const IN_PROGRESS = ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = storeContext.store.id
    const orderWhere = { storeId }
    const liveProduct = { storeId, NOT: { tags: { has: ARCHIVED_PRODUCT_TAG } } }
    const startOfToday = new Date(Math.floor((Date.now() + NEPAL_OFFSET_MS) / DAY_MS) * DAY_MS - NEPAL_OFFSET_MS)
    const weekStart = new Date(startOfToday.getTime() - 6 * DAY_MS)

    const [
      totalOrders,
      revenue,
      totalProducts,
      activeProducts,
      totalUsers,
      pendingOrders,
      inProgressOrders,
      weekOrders,
      recentOrders,
      outOfStock,
    ] = await Promise.all([
      prisma.order.count({ where: orderWhere }),
      prisma.order.aggregate({ where: { ...orderWhere, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.product.count({ where: liveProduct }),
      prisma.product.count({ where: { ...liveProduct, isAvailable: true } }),
      prisma.user.count({
        where: {
          role: { in: ['CUSTOMER', 'ADMIN'] },
          orders: { some: { storeId } },
        },
      }),
      prisma.order.count({ where: { ...orderWhere, status: 'PENDING' } }),
      prisma.order.count({ where: { ...orderWhere, status: { in: [...IN_PROGRESS] } } }),
      prisma.order.findMany({
        where: { ...orderWhere, createdAt: { gte: weekStart } },
        select: { total: true, status: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: orderWhere,
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      }),
      // Older databases may not have stock columns yet.
      prisma.product
        .count({ where: { ...liveProduct, isAvailable: true, trackStock: true, stockQty: { lte: 0 } } })
        .catch(() => null),
    ])

    const days = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(weekStart.getTime() + i * DAY_MS)
      return { date: nepalDayKey(start), orders: 0, revenue: 0 }
    })
    const byKey = new Map(days.map((day) => [day.date, day]))
    for (const order of weekOrders) {
      if (order.status === 'CANCELLED') continue
      const day = byKey.get(nepalDayKey(order.createdAt))
      if (!day) continue
      day.orders += 1
      day.revenue += order.total || 0
    }
    const today = days[days.length - 1]

    return NextResponse.json({
      storeName: storeContext.store.name,
      totalOrders,
      // Sales exclude cancelled orders.
      totalRevenue: revenue._sum.total || 0,
      totalProducts,
      activeProducts,
      inactiveProducts: Math.max(0, totalProducts - activeProducts),
      outOfStockProducts: outOfStock,
      totalUsers,
      pendingOrders,
      inProgressOrders,
      todayOrders: today.orders,
      todayRevenue: today.revenue,
      last7Days: days,
      recentOrders: recentOrders.map(({ user, ...order }) => ({ ...order, customerName: user?.name || null })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
