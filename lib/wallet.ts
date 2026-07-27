import { Prisma, WalletTxStatus, WalletTxType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAppSettings } from '@/lib/app-settings'
import { roundMoney, type WalletRules } from '@/lib/wallet-rules'

type Tx = Prisma.TransactionClient

export * from '@/lib/wallet-rules'

export async function getWalletRules(): Promise<WalletRules> {
  const settings = await getAppSettings()
  return {
    walletEnabled: settings.walletEnabled,
    cashbackPercent: settings.cashbackPercent,
    cashbackMaxAmount: settings.cashbackMaxAmount,
    walletMaxPercentPerOrder: settings.walletMaxPercentPerOrder,
    walletMaxAmountPerOrder: settings.walletMaxAmountPerOrder,
    checkoutMinPayable: settings.checkoutMinPayable,
  }
}

export async function getDeliveryRules() {
  const settings = await getAppSettings()
  return {
    freeDeliveryMinAmount: settings.freeDeliveryMinAmount,
    deliveryFeeAmount: settings.deliveryFeeAmount,
    checkoutMinOrderAmount: settings.checkoutMinOrderAmount,
  }
}

export async function getWalletBalance(userId: string): Promise<number> {
  const wallet = await prisma.walletAccount.findUnique({
    where: { userId },
    select: { balance: true },
  })
  return roundMoney(wallet?.balance ?? 0)
}

async function ensureWallet(tx: Tx, userId: string) {
  return tx.walletAccount.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
    select: { userId: true, balance: true },
  })
}

export async function getOrCreateWallet(userId: string) {
  return prisma.walletAccount.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  })
}

/**
 * Debit the wallet for an order. Safe to call twice: the unique
 * `(orderId, REDEEM)` ledger entry makes a repeat call a no-op.
 */
export async function redeemWallet(params: {
  userId: string
  orderId: string
  amount: number
  tx?: Tx
}): Promise<{ debited: boolean; balance: number }> {
  const amount = roundMoney(params.amount)
  if (amount <= 0) {
    return { debited: false, balance: await getWalletBalance(params.userId) }
  }

  const run = async (tx: Tx) => {
    const existing = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId: params.orderId, type: WalletTxType.REDEEM } },
      select: { id: true },
    })
    if (existing) {
      const wallet = await ensureWallet(tx, params.userId)
      return { debited: false, balance: roundMoney(wallet.balance) }
    }

    const wallet = await ensureWallet(tx, params.userId)
    if (wallet.balance + 0.001 < amount) {
      throw Object.assign(new Error('Insufficient wallet balance'), { status: 400 })
    }

    const balanceAfter = roundMoney(wallet.balance - amount)
    await tx.walletAccount.update({
      where: { userId: params.userId },
      data: { balance: balanceAfter },
    })
    await tx.walletTransaction.create({
      data: {
        userId: params.userId,
        orderId: params.orderId,
        type: WalletTxType.REDEEM,
        amount: -amount,
        balanceAfter,
        status: WalletTxStatus.COMPLETED,
        note: 'Wallet applied to order',
      },
    })
    await tx.order.update({
      where: { id: params.orderId },
      data: { walletDebited: true },
    })

    return { debited: true, balance: balanceAfter }
  }

  if (params.tx) return run(params.tx)
  return prisma.$transaction(run)
}

/** Give back wallet money when a debited order is cancelled or fails. */
export async function refundRedeem(orderId: string): Promise<{ refunded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const redeem = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId, type: WalletTxType.REDEEM } },
      select: { id: true, userId: true, amount: true, status: true },
    })
    if (!redeem || redeem.status !== WalletTxStatus.COMPLETED) {
      return { refunded: false }
    }

    const alreadyRefunded = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId, type: WalletTxType.REDEEM_REFUND } },
      select: { id: true },
    })
    if (alreadyRefunded) return { refunded: false }

    const amount = roundMoney(Math.abs(redeem.amount))
    if (amount <= 0) return { refunded: false }

    const wallet = await ensureWallet(tx, redeem.userId)
    const balanceAfter = roundMoney(wallet.balance + amount)

    await tx.walletAccount.update({
      where: { userId: redeem.userId },
      data: { balance: balanceAfter },
    })
    await tx.walletTransaction.create({
      data: {
        userId: redeem.userId,
        orderId,
        type: WalletTxType.REDEEM_REFUND,
        amount,
        balanceAfter,
        status: WalletTxStatus.COMPLETED,
        note: 'Wallet refunded for cancelled order',
      },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { walletDebited: false },
    })

    return { refunded: true }
  })
}

/**
 * Record cashback as pending at order time. It shows in the wallet as
 * "pending" and only becomes spendable once the order is delivered.
 */
export async function createPendingCashback(params: {
  userId: string
  orderId: string
  amount: number
  tx?: Tx
}): Promise<void> {
  const amount = roundMoney(params.amount)
  if (amount <= 0) return

  const run = async (tx: Tx) => {
    await ensureWallet(tx, params.userId)
    await tx.walletTransaction.create({
      data: {
        userId: params.userId,
        orderId: params.orderId,
        type: WalletTxType.CASHBACK_PENDING,
        amount,
        balanceAfter: null,
        status: WalletTxStatus.PENDING,
        note: 'Cashback pending until delivery',
      },
    })
  }

  if (params.tx) return run(params.tx)
  await prisma.$transaction(run)
}

/** Move pending cashback into the spendable balance. Called on DELIVERED. */
export async function creditPendingCashback(orderId: string): Promise<{ credited: number }> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId, type: WalletTxType.CASHBACK_PENDING } },
      select: { id: true, userId: true, amount: true, status: true },
    })
    if (!pending || pending.status !== WalletTxStatus.PENDING) {
      return { credited: 0 }
    }

    const amount = roundMoney(pending.amount)
    if (amount <= 0) {
      await tx.walletTransaction.update({
        where: { id: pending.id },
        data: { status: WalletTxStatus.VOIDED },
      })
      return { credited: 0 }
    }

    const wallet = await ensureWallet(tx, pending.userId)
    const balanceAfter = roundMoney(wallet.balance + amount)

    await tx.walletAccount.update({
      where: { userId: pending.userId },
      data: { balance: balanceAfter },
    })
    await tx.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: WalletTxStatus.COMPLETED,
        type: WalletTxType.CASHBACK_CREDIT,
        balanceAfter,
        note: 'Cashback credited after delivery',
      },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { cashbackStatus: 'CREDITED' },
    })

    return { credited: amount }
  })
}

/** Drop pending cashback for an order that will never be delivered. */
export async function voidPendingCashback(orderId: string): Promise<{ voided: boolean }> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.walletTransaction.findUnique({
      where: { orderId_type: { orderId, type: WalletTxType.CASHBACK_PENDING } },
      select: { id: true, status: true },
    })
    if (!pending || pending.status !== WalletTxStatus.PENDING) {
      return { voided: false }
    }

    await tx.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: WalletTxStatus.VOIDED,
        type: WalletTxType.CASHBACK_VOID,
        note: 'Cashback cancelled with the order',
      },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { cashbackStatus: 'VOIDED' },
    })

    return { voided: true }
  })
}

export type WalletSummary = {
  enabled: boolean
  balance: number
  pendingCashback: number
  cashbackPercent: number
  cashbackMaxAmount: number | null
  walletMaxPercentPerOrder: number
  walletMaxAmountPerOrder: number | null
  checkoutMinPayable: number
  checkoutMinOrderAmount: number
  freeDeliveryMinAmount: number
  deliveryFeeAmount: number
}

export async function getWalletSummary(userId: string): Promise<WalletSummary> {
  const [settings, balance, pending] = await Promise.all([
    getAppSettings(),
    getWalletBalance(userId),
    prisma.walletTransaction.aggregate({
      where: { userId, status: WalletTxStatus.PENDING },
      _sum: { amount: true },
    }),
  ])

  return {
    enabled: settings.walletEnabled,
    balance,
    pendingCashback: roundMoney(pending._sum.amount ?? 0),
    cashbackPercent: settings.cashbackPercent,
    cashbackMaxAmount: settings.cashbackMaxAmount,
    walletMaxPercentPerOrder: settings.walletMaxPercentPerOrder,
    walletMaxAmountPerOrder: settings.walletMaxAmountPerOrder,
    checkoutMinPayable: settings.checkoutMinPayable,
    checkoutMinOrderAmount: settings.checkoutMinOrderAmount,
    freeDeliveryMinAmount: settings.freeDeliveryMinAmount,
    deliveryFeeAmount: settings.deliveryFeeAmount,
  }
}
