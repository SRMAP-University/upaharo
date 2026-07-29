import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = storeContext.store.id
    const orderWhere = { storeId }

    const [totalOrders, ordersWithAmount, totalProducts, totalUsers, recentOrders] =
      await Promise.all([
        prisma.order.count({ where: orderWhere }),
        prisma.order.findMany({
          where: orderWhere,
          select: { total: true },
        }),
        prisma.product.count({
          where: {
            storeId,
            NOT: {
              tags: {
                has: ARCHIVED_PRODUCT_TAG,
              },
            },
          },
        }),
        prisma.user.count({
          where: {
            role: { in: ['CUSTOMER', 'ADMIN'] },
            orders: { some: { storeId } },
          },
        }),
        prisma.order.findMany({
          where: orderWhere,
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
        }),
      ])

    const totalRevenue = ordersWithAmount.reduce((sum, order) => sum + order.total, 0)

    return NextResponse.json({
      totalOrders,
      totalRevenue,
      totalProducts,
      totalUsers,
      recentOrders,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
