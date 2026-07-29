import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = storeContext.store.id

    const users = await prisma.user.findMany({
      where: {
        role: { in: ['CUSTOMER', 'ADMIN'] },
        orders: { some: { storeId } },
      },
      include: {
        orders: {
          where: { storeId },
          select: {
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            addresses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const response = users.map((user) => {
      const totalSpent = user.orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
      const lastOrderAt = user.orders.length > 0 ? user.orders[0].createdAt : null
      return {
        ...user,
        totalSpent,
        lastOrderAt,
        orderCount: user.orders.length,
        orders: undefined,
      }
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
