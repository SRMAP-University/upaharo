import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { getWalletSummary } from '@/lib/wallet'

const MAX_TRANSACTIONS = 50

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const limitParam = Number(request.nextUrl.searchParams.get('limit'))
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.round(limitParam), MAX_TRANSACTIONS)
      : 20

    const [summary, transactions] = await Promise.all([
      getWalletSummary(userId),
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          orderId: true,
          type: true,
          amount: true,
          balanceAfter: true,
          status: true,
          note: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({ ...summary, transactions })
  } catch (error) {
    console.error('Error fetching wallet:', error)
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
  }
}
