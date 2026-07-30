import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveStoreSlug } from '@/lib/store-context'

export type PartnerCapabilities = {
  sellerEnabled: boolean
  deliveryEnabled: boolean
  giftsEnabled: boolean
  groceryEnabled: boolean
}

export type PartnerIdentity = {
  userId: string
  email: string
  name: string
  phone: string | null
  role: string
  access: PartnerCapabilities
  sellerId: string | null
  deliveryPartnerId: string | null
}

const partnerInclude = {
  partnerAccess: true,
  seller: { select: { id: true, isActive: true } },
  deliveryPartner: { select: { id: true } },
} as const

export function allowedStoreSlugs(access: PartnerCapabilities): string[] {
  const slugs: string[] = []
  if (access.giftsEnabled) slugs.push('gifts')
  if (access.groceryEnabled) slugs.push('grocery')
  return slugs
}

async function resolveUserId(request: NextRequest | Request): Promise<string | null> {
  const token = getTokenFromRequest(request)
  if (token) {
    const payload = await verifyToken(token)
    if (payload?.userId) {
      return String(payload.userId)
    }
  }

  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return String(session.user.id)
  }

  return null
}

function toIdentity(user: {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  partnerAccess: PartnerCapabilities | null
  seller: { id: string; isActive: boolean } | null
  deliveryPartner: { id: string } | null
}): PartnerIdentity | null {
  const access = user.partnerAccess
  if (!access) return null
  if (!access.sellerEnabled && !access.deliveryEnabled) return null

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    access: {
      sellerEnabled: access.sellerEnabled,
      deliveryEnabled: access.deliveryEnabled,
      giftsEnabled: access.giftsEnabled,
      groceryEnabled: access.groceryEnabled,
    },
    sellerId: access.sellerEnabled && user.seller?.isActive !== false ? user.seller?.id ?? null : null,
    deliveryPartnerId: access.deliveryEnabled ? user.deliveryPartner?.id ?? null : null,
  }
}

export async function requirePartner(
  request: NextRequest | Request
): Promise<PartnerIdentity | null> {
  const userId = await resolveUserId(request)
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      ...partnerInclude,
    },
  })

  if (!user) return null
  return toIdentity(user)
}

export async function requireMerchant(
  request: NextRequest | Request
): Promise<PartnerIdentity | null> {
  const partner = await requirePartner(request)
  if (!partner?.access.sellerEnabled || !partner.sellerId) return null
  return partner
}

export async function requireDelivery(
  request: NextRequest | Request
): Promise<PartnerIdentity | null> {
  const partner = await requirePartner(request)
  if (!partner?.access.deliveryEnabled || !partner.deliveryPartnerId) return null
  return partner
}

/** Resolve partner by user id (e.g. after OTP). */
export async function loadPartnerByUserId(userId: string): Promise<PartnerIdentity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      ...partnerInclude,
    },
  })
  if (!user) return null
  return toIdentity(user)
}

/**
 * Store IDs the partner may access.
 * When `request` is provided, scopes to the selected store (`X-Store` / `?store=`).
 */
export async function resolveStoreIdsForPartner(
  access: PartnerCapabilities,
  request?: NextRequest | Request
): Promise<string[]> {
  let slugs = allowedStoreSlugs(access)
  if (slugs.length === 0) return []

  if (request) {
    const requested = resolveStoreSlug(request)
    if (!slugs.includes(requested)) {
      return []
    }
    slugs = [requested]
  }

  const stores = await prisma.store.findMany({
    where: { slug: { in: slugs }, isActive: true },
    select: { id: true },
  })
  return stores.map((s) => s.id)
}
