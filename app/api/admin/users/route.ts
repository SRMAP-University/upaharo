import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const users = await prisma.user.findMany({
      where: {
        role: { in: ['CUSTOMER', 'ADMIN'] },
      },
      include: {
        orders: {
          select: {
            total: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            orders: true,
            addresses: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const response = users.map((user) => {
      const totalSpent = user.orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
      const lastOrderAt = user.orders.length > 0 ? user.orders[0].createdAt : null
      return {
        ...user,
        totalSpent,
        lastOrderAt,
        orders: undefined,
      }
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
