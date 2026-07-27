/**
 * Pure wallet maths shared by the server and the checkout UIs.
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

/** Largest wallet amount spendable on an order of `orderTotal`, given `balance`. */
export function computeMaxWalletSpend(
  orderTotal: number,
  balance: number,
  rules: WalletRules
): number {
  if (!rules.walletEnabled) return 0
  const total = Math.max(0, orderTotal)
  const caps = [Math.max(0, balance), (total * rules.walletMaxPercentPerOrder) / 100, total]
  if (rules.walletMaxAmountPerOrder != null) {
    caps.push(rules.walletMaxAmountPerOrder)
  }
  return roundMoney(Math.max(0, Math.min(...caps)))
}
