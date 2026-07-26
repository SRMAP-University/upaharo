import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get seller profile
    const seller = await prisma.seller.findUnique({
      where: { userId: session.user.id },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    }

    // Get all orders that contain at least one product from this seller
    const orders = await prisma.order.findMany({
      where: {
        NOT: {
          AND: [{ paymentMethod: 'ONLINE' }, { paymentStatus: 'PENDING' }],
        },
        items: {
          some: {
            product: {
              sellerId: seller.id,
            },
          },
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        address: {
          select: {
            street: true,
            apartment: true,
            city: true,
            state: true,
            pincode: true,
          },
        },
        items: {
          where: {
            product: {
              sellerId: seller.id,
            },
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        placedAt: 'desc',
      },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching seller orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
