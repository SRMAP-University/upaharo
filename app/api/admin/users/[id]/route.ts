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
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    if (id === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.email.endsWith('@deleted.upaharo.local')) {
      return NextResponse.json({ error: 'User already deleted' }, { status: 400 })
    }

    const openStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const

    // Soft-delete: anonymize PII and revoke access. Keep order rows for records
    // (Order.user has no onDelete cascade, so hard delete fails for any customer with orders).
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: {
          userId: id,
          status: { in: [...openStatuses] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })

      await tx.order.updateMany({
        where: { userId: id },
        data: { addressId: null, recipientId: null },
      })

      await tx.coupon.updateMany({
        where: { createdByUserId: id },
        data: { createdByUserId: null },
      })

      await tx.deliveryPartner.updateMany({
        where: { userId: id },
        data: { userId: null },
      })

      await tx.deviceToken.deleteMany({ where: { userId: id } })
      await tx.appNotification.deleteMany({ where: { userId: id } })
      await tx.session.deleteMany({ where: { userId: id } })
      await tx.account.deleteMany({ where: { userId: id } })
      await tx.trustedDevice.deleteMany({ where: { userId: id } })
      await tx.address.deleteMany({ where: { userId: id } })
      await tx.giftRecipient.deleteMany({ where: { userId: id } })
      await tx.productViewEvent.deleteMany({ where: { userId: id } })
      await tx.businessProfile.deleteMany({ where: { userId: id } })
      await tx.wishlistItem.deleteMany({ where: { userId: id } })
      await tx.partnerAccess.deleteMany({ where: { userId: id } })
      await tx.seller.deleteMany({ where: { userId: id } })

      await tx.user.update({
        where: { id },
        data: {
          name: 'Deleted User',
          email: `deleted_${id}@deleted.upaharo.local`,
          phone: null,
          password: null,
          image: null,
          emailVerified: null,
          role: 'CUSTOMER',
        },
      })
    })

    return NextResponse.json({ message: 'User deleted' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
