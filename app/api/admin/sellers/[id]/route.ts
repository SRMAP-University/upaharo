import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        user: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    return NextResponse.json(seller)
  } catch (error) {
    console.error('Error fetching seller:', error)
    return NextResponse.json({ error: 'Failed to fetch seller' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id } = await params

    const seller = await prisma.seller.update({
      where: { id },
      data: {
        ...(body.businessName && { businessName: body.businessName }),
        ...(body.businessAddress && { businessAddress: body.businessAddress }),
        ...(body.gstin !== undefined && { gstin: body.gstin }),
        ...(body.phone && { phone: body.phone }),
        ...(body.email && { email: body.email }),
        ...(body.commission !== undefined && { commission: body.commission }),
        ...(body.bankAccountName !== undefined && { bankAccountName: body.bankAccountName }),
        ...(body.bankAccountNo !== undefined && { bankAccountNo: body.bankAccountNo }),
        ...(body.ifscCode !== undefined && { ifscCode: body.ifscCode }),
        ...(body.panNumber !== undefined && { panNumber: body.panNumber }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.isVerified !== undefined && { isVerified: body.isVerified }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(seller)
  } catch (error) {
    console.error('Error updating seller:', error)
    return NextResponse.json({ error: 'Failed to update seller' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if seller has products
    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    })

    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 })
    }

    if (seller._count.products > 0) {
      return NextResponse.json(
        { error: 'Cannot delete seller with existing products' },
        { status: 400 }
      )
    }

    // Delete seller (this will also delete the user due to cascade)
    await prisma.seller.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Seller deleted successfully' })
  } catch (error) {
    console.error('Error deleting seller:', error)
    return NextResponse.json({ error: 'Failed to delete seller' }, { status: 500 })
  }
}
