import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/utils'
import { notifyOrderPlaced } from '@/lib/notifications'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { resolveStoreContext } from '@/lib/store-context'

const B2B_DELIVERY_FEE = Number(process.env.B2B_DELIVERY_FEE || 0)

type IncomingItem = { id?: string; productId?: string; quantity?: number }

export async function POST(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const body = await request.json()
    const notes = String(body.notes || '').trim()
    const items = (Array.isArray(body.items) ? body.items : []) as IncomingItem[]

    if (!items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    const token = getTokenFromRequest(request)
    const payload = token ? await verifyToken(token) : null
    const userId = typeof payload?.userId === 'string' ? payload.userId : null

    if (!userId) {
      return NextResponse.json(
        { error: 'Please register or log in to your business account first' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        businessProfile: true,
        addresses: {
          where: { isDefault: true },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
    })

    if (!user?.businessProfile) {
      return NextResponse.json(
        { error: 'Business account required. Please register your shop.' },
        { status: 403 }
      )
    }

    const address =
      user.addresses[0] ??
      (await prisma.address.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      }))

    if (!address) {
      return NextResponse.json(
        { error: 'Shop address missing. Please complete business registration.' },
        { status: 400 }
      )
    }

    const businessName = user.businessProfile.shopName
    const contactName = user.name

    const productIds = items
      .map((i) => String(i.id || i.productId || '').trim())
      .filter(Boolean)

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        storeId: storeContext.store.id,
        isAvailable: true,
        wholesalePrice: { not: null },
      },
      select: {
        id: true,
        name: true,
        wholesalePrice: true,
        image: true,
      },
    })

    const byId = new Map(products.map((p) => [p.id, p]))
    const lineItems: { productId: string; quantity: number; price: number }[] = []

    for (const raw of items) {
      const id = String(raw.id || raw.productId || '').trim()
      const qty = Math.max(1, Math.round(Number(raw.quantity) || 1))
      const product = byId.get(id)
      if (!product || product.wholesalePrice == null) {
        return NextResponse.json(
          { error: `Product not available for wholesale: ${id || 'unknown'}` },
          { status: 400 }
        )
      }
      lineItems.push({
        productId: product.id,
        quantity: qty,
        price: Number(product.wholesalePrice),
      })
    }

    if (!lineItems.length) {
      return NextResponse.json({ error: 'No valid wholesale items' }, { status: 400 })
    }

    const subtotal = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const deliveryFee = Number.isFinite(B2B_DELIVERY_FEE) ? Math.max(0, B2B_DELIVERY_FEE) : 0
    const total = subtotal + deliveryFee
    const orderNumber = generateOrderNumber(storeContext.slug)

    const order = await prisma.order.create({
      data: {
        orderNumber,
        storeId: storeContext.store.id,
        userId: user.id,
        addressId: address.id,
        subtotal,
        deliveryFee,
        tax: 0,
        discount: 0,
        couponDiscount: 0,
        total,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        estimatedTime: 0,
        isGift: false,
        isWholesale: true,
        businessName,
        senderName: contactName,
        greetingMessage: notes || null,
        showSenderName: true,
        items: {
          create: lineItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, image: true } },
          },
        },
        address: true,
      },
    })

    void notifyOrderPlaced({
      userId: user.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
    }).catch((err) => console.error('B2B order notify failed:', err))

    return NextResponse.json(
      {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          subtotal: order.subtotal,
          deliveryFee: order.deliveryFee,
          businessName: order.businessName,
          status: order.status,
          items: order.items,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('B2B order error:', error)
    return NextResponse.json(
      { error: 'Failed to place wholesale order', details: error?.message },
      { status: 500 }
    )
  }
}

/** List wholesale orders for the logged-in business, or by email query (legacy). */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request)
    const payload = token ? await verifyToken(token) : null
    let userId = typeof payload?.userId === 'string' ? payload.userId : null

    if (!userId) {
      const email = String(new URL(request.url).searchParams.get('email') || '')
        .trim()
        .toLowerCase()
      if (!email) {
        return NextResponse.json({ error: 'Login required or pass email' }, { status: 400 })
      }
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, businessProfile: { select: { id: true } } },
      })
      if (!user?.businessProfile) {
        return NextResponse.json({ orders: [] })
      }
      userId = user.id
    } else {
      const biz = await prisma.businessProfile.findUnique({ where: { userId } })
      if (!biz) {
        return NextResponse.json({ error: 'Business account required' }, { status: 403 })
      }
    }

    const orders = await prisma.order.findMany({
      where: { userId, isWholesale: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        businessName: true,
        placedAt: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: { select: { name: true, image: true } },
          },
        },
      },
    })

    return NextResponse.json({ orders })
  } catch (error) {
    console.error('B2B orders list error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
