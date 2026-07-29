import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWalletBalance, roundMoney } from '@/lib/wallet'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    const user = await prisma.user.update({
      where: { id },
      data: {
        role: body.role,
      },
      include: {
        _count: {
          select: {
            orders: true,
            addresses: true,
          },
        },
      },
    })
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = storeContext.store.id
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          where: { storeId },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    category: true,
                  },
                },
              },
            },
            address: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            addresses: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [walletBalance, pendingCashback] = await Promise.all([
      getWalletBalance(id, storeId),
      prisma.walletTransaction.aggregate({
        where: { userId: id, storeId, status: 'PENDING' },
        _sum: { amount: true },
      }),
    ])

    const totalSpent = user.orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const completedOrders = user.orders.filter((order) => order.status === 'DELIVERED').length

    return NextResponse.json({
      ...user,
      totalSpent,
      completedOrders,
      orderCount: user.orders.length,
      walletBalance,
      pendingCashback: roundMoney(pendingCashback._sum.amount ?? 0),
    })
  } catch (error) {
    console.error('Error fetching user details:', error)
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    await prisma.user.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
