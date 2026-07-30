import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export {
  requirePartner,
  requireMerchant,
  requireDelivery,
  loadPartnerByUserId,
  allowedStoreSlugs,
  resolveStoreIdsForPartner,
  type PartnerIdentity,
  type PartnerCapabilities,
} from '@/lib/partner-auth'

export type AdminIdentity = {
  id: string
  email: string
  role: 'ADMIN'
}

export async function resolveUserId(request: NextRequest): Promise<string | null> {
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
 * Resolves an authenticated administrator from a verified bearer token or
 * NextAuth session. Roles always come from the database so stale tokens and
 * client-controlled session data cannot grant admin access.
 */
export async function requireAdmin(
  request: NextRequest | Request
): Promise<AdminIdentity | null> {
  const token = getTokenFromRequest(request)
  let userId: string | null = null

  if (token) {
    const payload = await verifyToken(token)
    if (payload?.userId) {
      userId = String(payload.userId)
    }
  }

  if (!userId) {
    const session = await getServerSession(authOptions)
    if (session?.user?.id) {
      userId = String(session.user.id)
    }
  }

  if (!userId) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  })

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return { id: user.id, email: user.email, role: 'ADMIN' }
}
