import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { requireAdmin } from '@/lib/request-auth'

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Get total orders
    const totalOrders = await prisma.order.count()

    // Get total revenue
    const ordersWithAmount = await prisma.order.findMany({
      select: { total: true }
    })
    const totalRevenue = ordersWithAmount.reduce((sum, order) => sum + order.total, 0)

    // Get total products
    const totalProducts = await prisma.product.count({
      where: {
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      }
    })

    // Get total users
    const totalUsers = await prisma.user.count()

    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      totalOrders,
      totalRevenue,
      totalProducts,
      totalUsers,
      recentOrders
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
