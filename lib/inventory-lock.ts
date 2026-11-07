/**
 * PIN lock for the admin Inventory area (stock, purchase prices, profit).
 * Admins unlock with a PIN; the server then sets a signed, httpOnly cookie
 * that only the inventory API reads. Only a salted scrypt hash of the PIN is
 * stored (table "AdminPin"); the PIN itself is never kept or logged.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { requireAdmin, type AdminIdentity } from '@/lib/request-auth'

const PIN_ID = 'inventory'
export const INVENTORY_COOKIE = 'upaharo_inventory'
/** Unlocked for 4 hours, then the PIN is asked again. */
const UNLOCK_SECONDS = 4 * 60 * 60
const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 15 * 60

function secret() {
  const value = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET or JWT_SECRET must be set for the inventory lock')
  return value
}

const hashPin = (pin: string, salt: string) => scryptSync(pin, salt, 64).toString('hex')

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,8}$/.test(pin)
}

export async function hasInventoryPin() {
  return Boolean(await prisma.adminPin.findUnique({ where: { id: PIN_ID }, select: { id: true } }))
}

export async function setInventoryPin(pin: string) {
  if (!isValidPin(pin)) throw new Error('PIN must be 4 to 8 digits')
  const salt = randomBytes(16).toString('hex')
  await prisma.adminPin.upsert({
    where: { id: PIN_ID },
    create: { id: PIN_ID, salt, hash: hashPin(pin, salt) },
    update: { salt, hash: hashPin(pin, salt) },
  })
}

export async function checkInventoryPin(pin: string) {
  if (!isValidPin(pin)) return false
  const row = await prisma.adminPin.findUnique({ where: { id: PIN_ID } })
  if (!row) return false
  const expected = Buffer.from(row.hash, 'hex')
  const actual = Buffer.from(hashPin(pin, row.salt), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const attemptsKey = (adminId: string) => `inventory-pin-attempts:${adminId}`

/** Seconds left on a lockout after too many wrong PINs, or 0. */
export async function pinLockoutSeconds(adminId: string) {
  const raw = await redis.get(attemptsKey(adminId))
  const data = raw ? (JSON.parse(raw) as { count: number; until: number }) : null
  if (!data || data.count < MAX_ATTEMPTS) return 0
  return Math.max(0, Math.ceil((data.until - Date.now()) / 1000))
}

/** Records a wrong PIN; returns how many tries remain before the lockout. */
export async function recordWrongPin(adminId: string) {
  const raw = await redis.get(attemptsKey(adminId))
  const data = raw ? (JSON.parse(raw) as { count: number; until: number }) : { count: 0, until: 0 }
  data.count += 1
  data.until = Date.now() + LOCKOUT_SECONDS * 1000
  await redis.setex(attemptsKey(adminId), LOCKOUT_SECONDS, JSON.stringify(data))
  return Math.max(0, MAX_ATTEMPTS - data.count)
}

export async function clearWrongPins(adminId: string) {
  await redis.del(attemptsKey(adminId))
}

/**
 * Asks for the PIN again before a delete, even while inventory is unlocked.
 * Null when it's right; otherwise the message and HTTP status to send. Wrong
 * tries count towards the same 15-minute lockout as unlocking.
 */
export async function confirmInventoryPin(adminId: string, pin: unknown): Promise<{ error: string; status: number } | null> {
  const wait = await pinLockoutSeconds(adminId)
  if (wait > 0) return { error: `Too many wrong PINs. Try again in ${Math.ceil(wait / 60)} min.`, status: 429 }
  if (!(await checkInventoryPin(String(pin ?? '')))) {
    const left = await recordWrongPin(adminId)
    return {
      error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong PIN. Locked for 15 minutes.',
      status: 403,
    }
  }
  await clearWrongPins(adminId)
  return null
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export function setUnlockCookie(response: NextResponse, adminId: string) {
  const expires = Math.floor(Date.now() / 1000) + UNLOCK_SECONDS
  const payload = `${adminId}.${expires}`
  response.cookies.set(INVENTORY_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: UNLOCK_SECONDS,
  })
}

export function clearUnlockCookie(response: NextResponse) {
  response.cookies.set(INVENTORY_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

function cookieValid(request: NextRequest, adminId: string) {
  const raw = request.cookies.get(INVENTORY_COOKIE)?.value || ''
  const [id, expires, signature] = raw.split('.')
  if (!id || !expires || !signature || id !== adminId) return false
  if (Number(expires) * 1000 < Date.now()) return false
  const expected = Buffer.from(sign(`${id}.${expires}`), 'hex')
  const actual = Buffer.from(signature, 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * The admin, when they are signed in as admin and have unlocked inventory with
 * the PIN; otherwise the reason ('signed-out' or 'locked').
 */
export async function requireInventoryAccess(
  request: NextRequest
): Promise<{ admin: AdminIdentity } | { error: 'signed-out' | 'locked' }> {
  const admin = await requireAdmin(request)
  if (!admin) return { error: 'signed-out' }
  if (!cookieValid(request, admin.id)) return { error: 'locked' }
  return { admin }
}
