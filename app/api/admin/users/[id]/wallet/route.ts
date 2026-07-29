import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adjustWallet, getWalletBalance, roundMoney } from '@/lib/wallet'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

/** Current wallet balance + recent adjustments for admin user detail. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const storeId = storeContext.store.id
    const { id: userId } = await params
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [balance, pending, transactions] = await Promise.all([
      getWalletBalance(userId, storeId),
      prisma.walletTransaction.aggregate({
        where: { userId, storeId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.findMany({
        where: { userId, storeId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          amount: true,
          balanceAfter: true,
          status: true,
          note: true,
          orderId: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      balance,
      pendingCashback: roundMoney(pending._sum.amount ?? 0),
      transactions,
    })
  } catch (error) {
    console.error('Error fetching admin user wallet:', error)
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
  }
}

/**
 * Credit (or optionally debit) a customer's wallet for the current admin store.
 * Body: { amount: number (>0 to add), note?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const { id: userId } = await params
    const body = await request.json().catch(() => ({}))
    const rawAmount = Number(body?.amount)
    const note = typeof body?.note === 'string' ? body.note : undefined

    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      return NextResponse.json(
        { error: 'Enter a non-zero amount' },
        { status: 400 }
      )
    }

    const allowDebit = Boolean(body?.allowDebit)
    if (rawAmount < 0 && !allowDebit) {
      return NextResponse.json(
        { error: 'Amount must be positive to add money' },
        { status: 400 }
      )
    }

    if (Math.abs(rawAmount) > 1_000_000) {
      return NextResponse.json({ error: 'Amount too large' }, { status: 400 })
    }

    const adminEmail = admin.email || 'admin'
    const result = await adjustWallet({
      userId,
      storeId: storeContext.store.id,
      amount: rawAmount,
      note: note
        ? `${note.trim()} (by ${adminEmail})`
        : `Admin credit by ${adminEmail}`,
    })

    return NextResponse.json({
      balance: result.balance,
      adjusted: result.adjusted,
    })
  } catch (error: unknown) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: number }).status)
        : 500
    const message =
      error instanceof Error ? error.message : 'Failed to adjust wallet'
    console.error('Error adjusting wallet:', error)
    return NextResponse.json(
      { error: message },
      { status: status === 400 || status === 404 ? status : 500 }
    )
  }
}
