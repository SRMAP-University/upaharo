import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'

/**
 * DELETE /api/account
 * Authenticated self-service account deletion (Play Store requirement).
 * Anonymizes PII, revokes devices/sessions, cancels open orders; keeps order rows for records.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.role === 'ADMIN' || user.role === 'SELLER') {
      return NextResponse.json(
        {
          error:
            'Admin and seller accounts cannot be deleted from the app. Contact support.',
        },
        { status: 403 }
      )
    }

    const openStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as const

    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: {
          userId,
          status: { in: [...openStatuses] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      })

      // Detach FKs before deleting related rows
      await tx.order.updateMany({
        where: { userId },
        data: { addressId: null, recipientId: null },
      })

      await tx.coupon.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: null },
      })

      await tx.deviceToken.deleteMany({ where: { userId } })
      await tx.appNotification.deleteMany({ where: { userId } })
      await tx.session.deleteMany({ where: { userId } })
      await tx.account.deleteMany({ where: { userId } })
      await tx.address.deleteMany({ where: { userId } })
      await tx.giftRecipient.deleteMany({ where: { userId } })
      await tx.productViewEvent.deleteMany({ where: { userId } })
      await tx.businessProfile.deleteMany({ where: { userId } })

      // Seller profile (if any) — customers normally won't have this
      await tx.seller.deleteMany({ where: { userId } })

      const tombstoneEmail = `deleted_${userId}@deleted.upaharo.local`

      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted User',
          email: tombstoneEmail,
          phone: null,
          password: null,
          image: null,
          emailVerified: null,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      message: 'Account deleted. You have been signed out.',
    })
  } catch (error: any) {
    console.error('Account delete error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete account' },
      { status: 500 }
    )
  }
}
