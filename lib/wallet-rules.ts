/**
 * Pure wallet + checkout maths shared by the server and the checkout UIs.
 *
 * Keep this file free of server-only imports (prisma, redis) so client
 * components can preview the same numbers the API will enforce.
 */

export type WalletRules = {
  walletEnabled: boolean
  cashbackPercent: number
  cashbackMaxAmount: number | null
  walletMaxPercentPerOrder: number
  walletMaxAmountPerOrder: number | null
  /** Remaining payable after wallet cannot fall below this. */
  checkoutMinPayable: number
}

export type DeliveryRules = {
  freeDeliveryMinAmount: number
  deliveryFeeAmount: number
}

/** Money is stored as Float; round every write so balances never drift. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/**
 * Cashback is earned on the amount the customer actually pays with money, so
 * wallet spend never compounds into more cashback.
 */
export function computeCashback(cashPaidAmount: number, rules: WalletRules): number {
  if (!rules.walletEnabled || rules.cashbackPercent <= 0) return 0
  const base = Math.max(0, cashPaidAmount)
  let cashback = (base * rules.cashbackPercent) / 100
  if (rules.cashbackMaxAmount != null) {
    cashback = Math.min(cashback, rules.cashbackMaxAmount)
  }
  return roundMoney(Math.max(0, cashback))
}

/**
 * Delivery fee from admin rules. `goodsTotal` is items + gift wrap (before
 * coupon/wallet). Free when goodsTotal >= freeDeliveryMinAmount.
 */
export function computeDeliveryFee(goodsTotal: number, rules: DeliveryRules): number {
  const goods = Math.max(0, goodsTotal)
  if (rules.deliveryFeeAmount <= 0) return 0
  if (goods >= rules.freeDeliveryMinAmount) return 0
  return roundMoney(rules.deliveryFeeAmount)
}

/** Largest wallet amount spendable on an order.
 * Cap is a % of the order total (not of the wallet balance), then limited by
 * available balance, absolute ₹ max, and checkoutMinPayable. */
export function computeMaxWalletSpend(
  orderTotal: number,
  balance: number,
  rules: WalletRules
): number {
  if (!rules.walletEnabled) return 0
  const total = Math.max(0, orderTotal)
  const percentOfOrder = (total * rules.walletMaxPercentPerOrder) / 100
  const leaveMinimum = Math.max(0, total - Math.max(0, rules.checkoutMinPayable))
  const caps = [Math.max(0, balance), percentOfOrder, total, leaveMinimum]
  if (rules.walletMaxAmountPerOrder != null) {
    caps.push(rules.walletMaxAmountPerOrder)
  }
  return roundMoney(Math.max(0, Math.min(...caps)))
}
