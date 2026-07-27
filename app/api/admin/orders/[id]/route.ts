import { NextRequest, NextResponse } from 'next/server'
import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { deliveryOtpsMatch, generateDeliveryOtp } from '@/lib/delivery-otp'
import {
  notifyOrderStatus,
  notifyPaymentUpdate,
  statusTimestampFields,
} from '@/lib/notifications'
import { releaseOrderWallet } from '@/lib/order-payment-lifecycle'
import { creditPendingCashback } from '@/lib/wallet'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    const existing = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        deliveryOtp: true,
      },
    })

    if (!existing) {
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

    if (nextStatus && nextStatus !== existing.status) {
      if (nextStatus === 'DELIVERED') {
        try {
          await creditPendingCashback(existing.id)
        } catch (err) {
          console.error('Failed to credit cashback on delivery:', err)
        }
      } else if (nextStatus === 'CANCELLED') {
        await releaseOrderWallet(existing.id)
      }
    }

    void (async () => {
      try {
        if (nextStatus && nextStatus !== existing.status) {
          await notifyOrderStatus({
            userId: existing.userId,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            status: nextStatus,
            deliveryOtp: order.deliveryOtp || issuedOtp || undefined,
          })
        }
        if (body.paymentStatus && body.paymentStatus !== existing.paymentStatus) {
          await notifyPaymentUpdate({
            userId: existing.userId,
            orderId: existing.id,
            orderNumber: existing.orderNumber,
            paymentStatus: body.paymentStatus,
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
