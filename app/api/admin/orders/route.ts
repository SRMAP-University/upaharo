import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Hide ONLINE checkouts that are still unpaid — they are not real orders yet.
    const orders = await prisma.order.findMany({
      where: {
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
      },
      include: {
        store: {
          select: {
            slug: true,
            name: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        address: {
          select: {
            label: true,
            street: true,
            apartment: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            latitude: true,
            longitude: true
          }
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
                image: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
