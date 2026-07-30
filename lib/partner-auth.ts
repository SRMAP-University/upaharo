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
  /** ADMIN partners can manage the full catalog + all store orders. */
  fullAccess: boolean
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

/**
 * ADMIN partners get merchant + delivery in the partner app.
 * Ensures Seller / DeliveryPartner rows exist so APIs can authorize.
 */
async function ensureAdminPartnerInfrastructure(user: {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  partnerAccess: {
    sellerEnabled: boolean
    deliveryEnabled: boolean
    giftsEnabled: boolean
    groceryEnabled: boolean
  } | null
  seller: { id: string; isActive: boolean } | null
  deliveryPartner: { id: string } | null
}) {
  if (user.role !== 'ADMIN' || !user.partnerAccess) return user

  let seller = user.seller
  let deliveryPartner = user.deliveryPartner
  let access = user.partnerAccess

  const needsAccessUpdate =
    !access.sellerEnabled || !access.deliveryEnabled

  if (needsAccessUpdate) {
    access = await prisma.partnerAccess.update({
      where: { userId: user.id },
      data: { sellerEnabled: true, deliveryEnabled: true },
    })
  }

  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        userId: user.id,
        businessName: user.name,
        businessAddress: '—',
        phone: user.phone || '',
        email: user.email,
        commission: 0,
        isActive: true,
        isVerified: true,
      },
      select: { id: true, isActive: true },
    })
  } else if (seller.isActive === false) {
    seller = await prisma.seller.update({
      where: { userId: user.id },
      data: { isActive: true, isVerified: true },
      select: { id: true, isActive: true },
    })
  }

  if (!deliveryPartner) {
    const phone =
      user.phone || `admin-dp-${user.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`
    try {
      deliveryPartner = await prisma.deliveryPartner.create({
        data: {
          userId: user.id,
          name: user.name,
          phone,
          email: user.email,
          vehicleType: 'bike',
          vehicleNumber: '',
          isAvailable: false,
        },
        select: { id: true },
      })
    } catch (err) {
      // Phone/email uniqueness — link an existing unlinked row or retry with unique phone
      console.error('ensureAdminPartnerInfrastructure deliveryPartner:', err)
      deliveryPartner = await prisma.deliveryPartner.create({
        data: {
          userId: user.id,
          name: user.name,
          phone: `admin-dp-${user.id.slice(-10)}-${Date.now().toString(36)}`,
          email: `dp_${user.id}@partner.upaharo.local`,
          vehicleType: 'bike',
          vehicleNumber: '',
          isAvailable: false,
        },
        select: { id: true },
      })
    }
  }

  return {
    ...user,
    partnerAccess: access,
    seller,
    deliveryPartner,
  }
}

function toIdentity(user: {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  partnerAccess: {
    sellerEnabled: boolean
    deliveryEnabled: boolean
    giftsEnabled: boolean
    groceryEnabled: boolean
  } | null
  seller: { id: string; isActive: boolean } | null
  deliveryPartner: { id: string } | null
}): PartnerIdentity | null {
  const access = user.partnerAccess
  if (!access) return null

  const fullAccess = user.role === 'ADMIN'
  const sellerEnabled = fullAccess || access.sellerEnabled
  const deliveryEnabled = fullAccess || access.deliveryEnabled

  if (!sellerEnabled && !deliveryEnabled) return null

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    access: {
      sellerEnabled,
      deliveryEnabled,
      giftsEnabled: access.giftsEnabled,
      groceryEnabled: access.groceryEnabled,
      fullAccess,
    },
    sellerId:
      sellerEnabled && user.seller?.isActive !== false
        ? user.seller?.id ?? null
        : null,
    deliveryPartnerId: deliveryEnabled
      ? user.deliveryPartner?.id ?? null
      : null,
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
  const ensured = await ensureAdminPartnerInfrastructure(user)
  return toIdentity(ensured)
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
  const ensured = await ensureAdminPartnerInfrastructure(user)
  return toIdentity(ensured)
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
