import { prisma } from '@/lib/prisma'

type SellerResult = { ok: true; sellerId: string | null | undefined } | { ok: false; error: string }

/**
 * Admin product payload → seller to list the product under.
 * `undefined` leaves the current seller alone; empty or null means the store sells it.
 */
export async function resolveProductSellerId(raw: unknown): Promise<SellerResult> {
  if (raw === undefined) return { ok: true, sellerId: undefined }
  const id = raw === null ? '' : String(raw).trim()
  if (!id) return { ok: true, sellerId: null }

  const seller = await prisma.seller.findUnique({ where: { id }, select: { id: true } })
  if (!seller) return { ok: false, error: 'Seller not found' }
  return { ok: true, sellerId: seller.id }
}
