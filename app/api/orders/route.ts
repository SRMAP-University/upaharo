import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/utils'
import { ARCHIVED_PRODUCT_TAG } from '@/lib/product-archive'
import { LEGACY_PRODUCT_SELECT } from '@/lib/product-db'
import { resolveUserId } from '@/lib/request-auth'
import { isKathmanduValleyLocation, SERVICE_AREA_UNAVAILABLE_MESSAGE } from '@/lib/service-area'
import { validateCoupon } from '@/lib/coupon'
import { createStripeCheckoutSession, isStripeConfigured } from '@/lib/stripe'
import {
  abandonUnpaidOnlineOrder,
  activateOrderFulfillment,
} from '@/lib/order-payment-lifecycle'
import {
  computeCashback,
  computeDeliveryFee,
  computeMaxWalletSpend,
  createPendingCashback,
  getDeliveryRules,
  getWalletBalance,
  getWalletRules,
  redeemWallet,
  roundMoney,
} from '@/lib/wallet'

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      items, 
      addressId, 
      addressLatitude,
      addressLongitude,
      paymentMethod, 
      subtotal, 
      deliveryFee, 
      total,
      isGift,
      recipientId,
      occasionId,
      giftWrapId,
      greetingMessage,
      senderName,
      showSenderName,
      couponCode,
      walletAmount,
    } = body

    if (paymentMethod !== 'CASH' && paymentMethod !== 'ONLINE') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    if (paymentMethod === 'ONLINE' && !isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is not configured. Please use cash on delivery.' },
        { status: 503 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty' },
        { status: 400 }
      )
    }

    const productIds = items
      .map((item: any) => String(item?.id || '').trim())
      .filter(Boolean)

    const availableProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isAvailable: true,
        NOT: {
          tags: {
            has: ARCHIVED_PRODUCT_TAG,
          },
        },
      },
      select: { id: true },
    })

    if (availableProducts.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Some items are no longer available' },
        { status: 400 }
      )
    }

    const [user, address] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
        },
      }),
      addressId
        ? prisma.address.findUnique({
            where: { id: addressId },
            select: {
              id: true,
              street: true,
              city: true,
              state: true,
              pincode: true,
              latitude: true,
              longitude: true,
            },
          })
        : Promise.resolve(null),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!addressId || !address) {
      return NextResponse.json({ error: 'Please select a delivery address' }, { status: 400 })
    }

    const lat = typeof addressLatitude === 'number' ? addressLatitude : Number(addressLatitude)
    const lng = typeof addressLongitude === 'number' ? addressLongitude : Number(addressLongitude)
    const hasIncomingCoords = Number.isFinite(lat) && Number.isFinite(lng)

    if (hasIncomingCoords && address.latitude === 0 && address.longitude === 0) {
      await prisma.address.update({
        where: { id: address.id },
        data: {
          latitude: lat,
          longitude: lng,
        },
      })
    }

    const resolvedLatitude = hasIncomingCoords ? lat : address.latitude
    const resolvedLongitude = hasIncomingCoords ? lng : address.longitude

    if (
      !isKathmanduValleyLocation({
        city: address.city,
        state: address.state,
        address: address.street,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
      })
    ) {
      return NextResponse.json({ error: SERVICE_AREA_UNAVAILABLE_MESSAGE }, { status: 400 })
    }

    // Generate order number
    const orderNumber = generateOrderNumber()

    const resolvedSubtotal = Number(subtotal) || 0
    const resolvedTax = 0

    let couponId: string | undefined
    let couponDiscount = 0
    if (couponCode?.trim()) {
      const result = await validateCoupon(couponCode, {
        subtotal: resolvedSubtotal,
        productIds,
      })

      if (!result.valid || !result.coupon) {
        return NextResponse.json(
          { error: result.message || 'Invalid coupon' },
          { status: 400 }
        )
      }

      couponId = result.coupon.id
      couponDiscount = result.discount
    }

    let giftWrapFee = 0
    if (isGift && giftWrapId) {
      const wrap = await prisma.giftWrap.findUnique({
        where: { id: giftWrapId },
        select: { price: true },
      })
      giftWrapFee = wrap?.price ?? 0
    }

    const deliveryRules = await getDeliveryRules()
    const goodsTotal = resolvedSubtotal + giftWrapFee

    if (
      deliveryRules.checkoutMinOrderAmount > 0 &&
      goodsTotal + 0.001 < deliveryRules.checkoutMinOrderAmount
    ) {
      return NextResponse.json(
        {
          error: `Minimum order amount is Rs ${deliveryRules.checkoutMinOrderAmount}`,
        },
        { status: 400 }
      )
    }

    // Server-authoritative delivery fee from admin settings.
    const resolvedDeliveryFee = computeDeliveryFee(goodsTotal, deliveryRules)

    // Server-authoritative total (includes gift wrap when selected).
    const totalBeforeWallet = Math.max(
      0,
      goodsTotal + resolvedDeliveryFee - couponDiscount
    )

    // Wallet spend is always re-capped here; the client value is only a request.
    const walletRules = await getWalletRules()
    const requestedWallet = Math.max(0, Number(walletAmount) || 0)
    let walletDiscount = 0
    if (walletRules.walletEnabled && requestedWallet > 0) {
      const balance = await getWalletBalance(userId)
      walletDiscount = Math.min(
        roundMoney(requestedWallet),
        computeMaxWalletSpend(totalBeforeWallet, balance, walletRules)
      )
    }

    const resolvedTotal = roundMoney(Math.max(0, totalBeforeWallet - walletDiscount))
    const cashbackAmount = computeCashback(resolvedTotal, walletRules)

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId,
          subtotal: resolvedSubtotal,
          deliveryFee: resolvedDeliveryFee,
          tax: resolvedTax,
          discount: couponDiscount,
          couponDiscount,
          couponId,
          walletDiscount,
          cashbackAmount,
          cashbackStatus: cashbackAmount > 0 ? 'PENDING' : 'NONE',
          total: resolvedTotal,
          paymentMethod,
          estimatedTime: 0,
          isGift: isGift || false,
          recipientId: isGift ? recipientId : null,
          occasionId: isGift ? occasionId : null,
          giftWrapId: isGift ? giftWrapId : null,
          greetingMessage: isGift ? greetingMessage : null,
          senderName: isGift ? senderName : null,
          showSenderName: isGift ? (showSenderName || false) : false,
          items: {
            create: items.map((item: any) => ({
              productId: item.id,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: LEGACY_PRODUCT_SELECT,
              },
            },
          },
          address: true,
          recipient: true,
          giftWrap: true,
          occasion: true,
          coupon: true,
        },
      })

      // COD: reserve coupon now. ONLINE: reserve only after Stripe payment succeeds.
      if (couponId && paymentMethod !== 'ONLINE') {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        })
      }

      if (cashbackAmount > 0) {
        await createPendingCashback({
          userId,
          orderId: created.id,
          amount: cashbackAmount,
          tx,
        })
      }

      // Debit immediately so two concurrent checkouts can't spend the same
      // balance. Abandoned online payments refund it via abandonUnpaidOnlineOrder.
      if (walletDiscount > 0) {
        await redeemWallet({ userId, orderId: created.id, amount: walletDiscount, tx })
      }

      return created
    })

    // Wallet covered the whole bill, so there is nothing for Stripe to charge.
    if (paymentMethod === 'ONLINE' && resolvedTotal <= 0) {
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'COMPLETED' },
      })
      await activateOrderFulfillment({
        id: order.id,
        userId: order.userId,
        orderNumber: order.orderNumber,
        couponId: couponId ?? null,
      })

      return NextResponse.json(
        { order: { ...order, paymentStatus: 'COMPLETED' } },
        { status: 201 }
      )
    }

    if (paymentMethod === 'ONLINE') {
      try {
        const origin =
          request.headers.get('origin') ||
          process.env.NEXT_PUBLIC_APP_URL ||
          request.nextUrl.origin
        const baseUrl = origin.replace(/\/$/, '')

        const session = await createStripeCheckoutSession({
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId,
          amountMajor: Number(order.total),
          customerEmail: user.email,
          customerName: user.name,
          successUrl: `${baseUrl}/checkout/stripe-return?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/checkout?canceled=1&orderId=${order.id}`,
        })

        if (!session.url) {
          throw new Error('Stripe Checkout URL was not returned')
        }

        // Do NOT notify / publish until webhook/confirm marks payment COMPLETED.
        return NextResponse.json(
          {
            order,
            paymentUrl: session.url,
            paymentProvider: 'STRIPE',
            checkoutSessionId: session.id,
          },
          { status: 201 }
        )
      } catch (paymentError: any) {
        await abandonUnpaidOnlineOrder(order.id)
        console.error('Failed to start Stripe Checkout:', paymentError)
        return NextResponse.json(
          {
            error: 'Failed to start online payment',
            details: paymentError?.message || 'Unknown Stripe error',
            orderId: order.id,
          },
          { status: 500 }
        )
      }
    }

    // COD only: order is ready for fulfillment immediately.
    await activateOrderFulfillment({
      id: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      // Coupon already incremented in the transaction for CASH.
      couponId: null,
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating order:', error)
    console.error('Error details:', error.message, error.stack)
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: LEGACY_PRODUCT_SELECT,
            },
          },
        },
        address: true,
        recipient: true,
        giftWrap: true,
        occasion: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}
