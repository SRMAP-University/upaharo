import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getProductStats } from '@/lib/product-stats'

/** Seller dashboard → stats for the seller's own products only (?days=1|7|30|90). */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const seller = await prisma.seller.findUnique({ where: { userId: session.user.id }, select: { id: true } })
    if (!seller) return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 })
    const days = Number(new URL(request.url).searchParams.get('days')) || 30
    const stats = await getProductStats({ productWhere: { sellerId: seller.id }, days })
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('Seller product stats error:', error)
    return NextResponse.json({ error: 'Failed to load product stats' }, { status: 500 })
  }
}
