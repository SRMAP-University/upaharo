import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireDelivery,
  resolveStoreIdsForPartner,
} from '@/lib/partner-auth'
import { deliveryOtpsMatch, generateDeliveryOtp } from '@/lib/delivery-otp'
import {
  notifyOrderStatus,
  statusTimestampFields,
} from '@/lib/notifications'
import { creditPendingCashback } from '@/lib/wallet'

const orderInclude = {
  store: { select: { id: true, slug: true, name: true } },
  user: { select: { name: true, phone: true } },
  address: true,
  items: {
    include: {
      product: { select: { id: true, name: true, image: true } },
    },
  },
} as const

/**
 * Claim (accept) a READY order from the open pool, or deliver with OTP.
 * body.action: "claim" | "deliver"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const partner = await requireDelivery(request)
    if (!partner?.deliveryPartnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const action = String(body.action || 'claim')

    if (action === 'claim') {
      const storeIds = await resolveStoreIdsForPartner(partner.access)

      // One active job at a time
      const existingActive = await prisma.order.findFirst({
        where: {
          deliveryPartnerId: partner.deliveryPartnerId,
          status: 'OUT_FOR_DELIVERY',
        },
        select: { id: true, orderNumber: true },
      })
      if (existingActive) {
        return NextResponse.json(
          {
            error: `Finish delivery #${existingActive.orderNumber} before accepting another`,
          },
          { status: 409 }
        )
      }

      const dp = await prisma.deliveryPartner.findUnique({
        where: { id: partner.deliveryPartnerId },
        select: { isAvailable: true },
      })
      if (!dp?.isAvailable) {
        return NextResponse.json(
          { error: 'Go online before accepting orders' },
          { status: 400 }
        )
      }

      const issuedOtp = generateDeliveryOtp()

      // Atomic claim: only updates if still unassigned + READY
      const claimed = await prisma.order.updateMany({
        where: {
          id,
          storeId: { in: storeIds },
          status: 'READY',
          fulfillmentType: 'DELIVERY',
          deliveryPartnerId: null,
        },
        data: {
          deliveryPartnerId: partner.deliveryPartnerId,
          status: 'OUT_FOR_DELIVERY',
          ...statusTimestampFields('OUT_FOR_DELIVERY'),
          deliveryOtp: issuedOtp,
          deliveryOtpCreatedAt: new Date(),
        },
      })

      if (claimed.count === 0) {
        return NextResponse.json(
          { error: 'Order is no longer available' },
          { status: 409 }
        )
      }

      const order = await prisma.order.findUnique({
        where: { id },
        include: orderInclude,
      })

      if (order) {
        void notifyOrderStatus({
          userId: order.userId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          status: 'OUT_FOR_DELIVERY',
          storeId: order.storeId,
          deliveryOtp: issuedOtp,
        }).catch((err) => console.error('notifyOrderStatus', err))
      }

      return NextResponse.json(order)
    }

    if (action === 'deliver') {
      const existing = await prisma.order.findFirst({
        where: {
          id,
          deliveryPartnerId: partner.deliveryPartnerId,
          status: 'OUT_FOR_DELIVERY',
        },
        select: {
          id: true,
          userId: true,
          orderNumber: true,
          status: true,
          deliveryOtp: true,
          storeId: true,
        },
      })

      if (!existing) {
        return NextResponse.json({ error: 'Active delivery not found' }, { status: 404 })
      }

      if (!existing.deliveryOtp) {
        return NextResponse.json(
          { error: 'No delivery OTP on this order' },
          { status: 400 }
        )
      }

      if (!deliveryOtpsMatch(existing.deliveryOtp, body.deliveryOtp)) {
        return NextResponse.json(
          { error: 'Invalid delivery OTP' },
          { status: 400 }
        )
      }

      const order = await prisma.order.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          ...statusTimestampFields('DELIVERED'),
        },
        include: orderInclude,
      })

      try {
        await creditPendingCashback(existing.id)
      } catch (err) {
        console.error('cashback on deliver:', err)
      }

      void notifyOrderStatus({
        userId: existing.userId,
        orderId: existing.id,
        orderNumber: existing.orderNumber,
        status: 'DELIVERED',
        storeId: existing.storeId,
      }).catch((err) => console.error('notifyOrderStatus', err))

      return NextResponse.json(order)
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Delivery order action:', error)
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 })
  }
}
