import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

/** How long a trusted phone↔device pair can skip OTP (180 days). */
export const TRUSTED_DEVICE_TTL_MS = 180 * 24 * 60 * 60 * 1000
const MAX_DEVICES_PER_USER = 5

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex')
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}

export function normalizeDeviceId(input: unknown): string | null {
  const id = String(input ?? '').trim()
  if (id.length < 8 || id.length > 128) return null
  if (!/^[a-zA-Z0-9._:-]+$/.test(id)) return null
  return id
}

/**
 * Upsert trust for this install after a successful OTP login/signup.
 * Returns the raw device token for the client to store (shown once).
 */
export async function issueTrustedDevice(params: {
  userId: string
  phone: string
  deviceId: string
  platform?: string | null
}): Promise<{ deviceToken: string; expiresAt: Date }> {
  const deviceToken = generateDeviceToken()
  const tokenHash = hashDeviceToken(deviceToken)
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_MS)
  const platform = params.platform?.trim().slice(0, 32) || null

  await prisma.trustedDevice.upsert({
    where: {
      deviceId_phone: {
        deviceId: params.deviceId,
        phone: params.phone,
      },
    },
    create: {
      userId: params.userId,
      phone: params.phone,
      deviceId: params.deviceId,
      tokenHash,
      platform,
      expiresAt,
      lastUsedAt: new Date(),
    },
    update: {
      userId: params.userId,
      tokenHash,
      platform,
      expiresAt,
      lastUsedAt: new Date(),
    },
  })

  // Cap devices per user — drop oldest beyond the limit.
  const devices = await prisma.trustedDevice.findMany({
    where: { userId: params.userId },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true },
  })
  if (devices.length > MAX_DEVICES_PER_USER) {
    const dropIds = devices.slice(MAX_DEVICES_PER_USER).map((d) => d.id)
    await prisma.trustedDevice.deleteMany({ where: { id: { in: dropIds } } })
  }

  return { deviceToken, expiresAt }
}

export async function authenticateTrustedDevice(params: {
  phone: string
  deviceId: string
  deviceToken: string
}): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashDeviceToken(params.deviceToken)
  const row = await prisma.trustedDevice.findUnique({
    where: {
      deviceId_phone: {
        deviceId: params.deviceId,
        phone: params.phone,
      },
    },
    include: {
      user: { select: { id: true, email: true, phone: true } },
    },
  })

  if (!row) return null
  if (row.tokenHash !== tokenHash) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.trustedDevice.delete({ where: { id: row.id } }).catch(() => null)
    return null
  }
  if (row.user.phone !== params.phone) return null

  // Rotate token expiry / last used; keep same secret so client storage stays valid.
  await prisma.trustedDevice.update({
    where: { id: row.id },
    data: {
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + TRUSTED_DEVICE_TTL_MS),
    },
  })

  return { userId: row.user.id, email: row.user.email }
}

export async function revokeTrustedDevice(params: {
  phone: string
  deviceId: string
}): Promise<void> {
  await prisma.trustedDevice
    .deleteMany({
      where: { phone: params.phone, deviceId: params.deviceId },
    })
    .catch(() => null)
}
