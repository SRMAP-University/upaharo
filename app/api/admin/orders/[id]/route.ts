import { NextRequest, NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deliveryOtpsMatch, generateDeliveryOtp } from '@/lib/delivery-otp'
import {
  notifyDeliveryPartnersJobAvailable,
  notifyOrderStatus,
  notifyPaymentUpdate,
  statusTimestampFields,
} from '@/lib/notifications'
import { releaseOrderWallet } from '@/lib/order-payment-lifecycle'
import { creditPendingCashback } from '@/lib/wallet'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    const existing = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        storeId: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        deliveryOtp: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (existing.storeId !== storeContext.store.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const nextStatus = body.status ? (String(body.status) as OrderStatus) : null
    let issuedOtp: string | null = null

    if (nextStatus) {
      // Confirm delivery with customer-shared OTP
      if (nextStatus === 'DELIVERED' && existing.status !== 'DELIVERED') {
        if (!existing.deliveryOtp) {
          return NextResponse.json(
            {
              error:
                'No delivery OTP on this order. Mark it Out for delivery first so the customer gets a code.',
            },
            { status: 400 }
          )
        }
        if (!deliveryOtpsMatch(existing.deliveryOtp, body.deliveryOtp)) {
          return NextResponse.json(
            { error: 'Invalid delivery OTP. Ask the customer for the code shown in their app.' },
            { status: 400 }
          )
        }
      }

      updateData.status = nextStatus
      Object.assign(updateData, statusTimestampFields(nextStatus))

      // Issue OTP when order is ready / out for delivery
      if (nextStatus !== existing.status) {
        if (nextStatus === 'OUT_FOR_DELIVERY') {
          issuedOtp = generateDeliveryOtp()
          updateData.deliveryOtp = issuedOtp
          updateData.deliveryOtpCreatedAt = new Date()
        } else if (nextStatus === 'READY' && !existing.deliveryOtp) {
          issuedOtp = generateDeliveryOtp()
          updateData.deliveryOtp = issuedOtp
          updateData.deliveryOtpCreatedAt = new Date()
        }
      }
    }

    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus
    if (body.estimatedTime !== undefined) {
      const estimatedTime = Number(body.estimatedTime)
      if (!Number.isFinite(estimatedTime) || estimatedTime < 0) {
        return NextResponse.json({ error: 'estimatedTime must be a non-negative number' }, { status: 400 })
      }
      updateData.estimatedTime = Math.round(estimatedTime)
    }

    // Admin assign / unassign delivery partner (hybrid model)
    if (body.deliveryPartnerId !== undefined) {
      if (body.deliveryPartnerId === null || body.deliveryPartnerId === '') {
        updateData.deliveryPartnerId = null
      } else {
        const rider = await prisma.deliveryPartner.findUnique({
          where: { id: String(body.deliveryPartnerId) },
          select: { id: true },
        })
        if (!rider) {
          return NextResponse.json(
            { error: 'Delivery partner not found' },
            { status: 400 }
          )
        }
        updateData.deliveryPartnerId = rider.id
        // If still READY, move to OUT_FOR_DELIVERY on assign
        if (
          (!nextStatus || nextStatus === existing.status) &&
          existing.status === 'READY'
        ) {
          updateData.status = 'OUT_FOR_DELIVERY'
          Object.assign(updateData, statusTimestampFields('OUT_FOR_DELIVERY'))
          if (!existing.deliveryOtp) {
            issuedOtp = generateDeliveryOtp()
            updateData.deliveryOtp = issuedOtp
            updateData.deliveryOtpCreatedAt = new Date()
          }
        }
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
        address: true,
        deliveryPartner: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehicleType: true,
            vehicleNumber: true,
          },
        },
        recipient: {
          select: {
            name: true,
            phone: true,
            relationship: true,
          },
        },
        occasion: {
          select: {
            name: true,
            emoji: true,
          },
        },
        giftWrap: {
          select: {
            name: true,
            type: true,
            price: true,
            image: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    })

    const effectiveStatus =
      (updateData.status as OrderStatus | undefined) || nextStatus
    if (effectiveStatus && effectiveStatus !== existing.status) {
      if (effectiveStatus === 'DELIVERED') {
        try {
          await creditPendingCashback(existing.id)
        } catch (err) {
          console.error('Failed to credit cashback on delivery:', err)
        }
      } else if (effectiveStatus === 'CANCELLED') {
        await releaseOrderWallet(existing.id)
      }
    }

    void (async () => {
      try {
        if (effectiveStatus && effectiveStatus !== existing.status) {
          await notifyOrderStatus({
            userId: existing.userId,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            status: effectiveStatus,
            deliveryOtp: order.deliveryOtp || issuedOtp || undefined,
            storeId: existing.storeId,
          })
          if (effectiveStatus === 'READY') {
            await notifyDeliveryPartnersJobAvailable({
              orderId: existing.id,
              orderNumber: existing.orderNumber,
              storeId: existing.storeId,
            })
          }
        }
        if (body.paymentStatus && body.paymentStatus !== existing.paymentStatus) {
          await notifyPaymentUpdate({
            userId: existing.userId,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            paymentStatus: body.paymentStatus,
            storeId: existing.storeId,
          })
        }
      } catch (err) {
        console.error('Order update notification failed:', err)
      }
    })()

    return NextResponse.json(order)
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
