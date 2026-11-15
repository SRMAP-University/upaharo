import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { dayBounds } from '@/lib/promo-game-award'

/**
 * Gift Catch: the web "Play & Win" game. Play as often as you like; one
 * coupon a day per account, worth up to 10% depending on the score.
 *
 * The server never trusts the client's discount: each game starts with a
 * signed token (start time), the claim must come after a full game, the
 * score must be plausible, and the percent is worked out here from the score.
 */

export const CATCH_GAME = 'catch'
export const CATCH_SECONDS = 45
/** Highest score a real 45 s game can reach (generous); anything above is refused. */
export const CATCH_MAX_SCORE = 900

export const CATCH_TIERS = [
  { min: 20, percent: 3 },
  { min: 50, percent: 5 },
  { min: 90, percent: 7 },
  { min: 140, percent: 10 },
] as const

export function percentForScore(score: number) {
  let percent = 0
  for (const tier of CATCH_TIERS) if (score >= tier.min) percent = tier.percent
  return percent
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  if (!value) throw new Error('NEXTAUTH_SECRET or JWT_SECRET must be set for Gift Catch')
  return value
}

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const sign = (data: string) => createHmac('sha256', secret()).update(`gift-catch:${data}`).digest('base64url')

/** A token that proves a game started at this time, for this store. */
export function signCatchToken(storeId: string) {
  const payload = b64(JSON.stringify({ s: storeId, t: Date.now(), n: randomBytes(6).toString('hex') }))
  return `${payload}.${sign(payload)}`
}

export function verifyCatchToken(token: unknown, storeId: string): { ok: true; startedAt: number } | { ok: false; reason: string } {
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'Missing game token' }
  const [payload, sig] = token.split('.')
  const expected = sign(payload)
  const a = Buffer.from(sig || '')
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'Invalid game token' }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { s: string; t: number }
    if (data.s !== storeId) return { ok: false, reason: 'Invalid game token' }
    return { ok: true, startedAt: Number(data.t) }
  } catch {
    return { ok: false, reason: 'Invalid game token' }
  }
}

export async function todaysCatchClaim(storeId: string, userId: string) {
  const { start, end } = dayBounds()
  const play = await prisma.promoGamePlay.findFirst({
    where: { storeId, userId, gameType: CATCH_GAME, playedAt: { gte: start, lt: end } },
    orderBy: { playedAt: 'desc' },
  })
  if (!play) return null
  const coupon = play.couponId
    ? await prisma.coupon.findFirst({ where: { id: play.couponId, storeId }, select: { code: true, endAt: true } })
    : null
  return { percent: play.percent, code: coupon?.code ?? null, endAt: coupon?.endAt?.toISOString() ?? null }
}

function couponCode(percent: number, userId: string) {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'USER'
  const rand = randomBytes(3).toString('hex').toUpperCase()
  return `GIFT${percent}-${tail}${rand}`
}

/** Create today's single-use coupon for this score (once a day per account). */
export async function claimCatchCoupon(storeId: string, userId: string, score: number) {
  const percent = percentForScore(score)
  const { start, end } = dayBounds()
  // One claim at a time per account and day, so two quick taps cannot win twice.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`gift-catch:${storeId}:${userId}:${start.toISOString()}`}))`
    const play = await tx.promoGamePlay.findFirst({
      where: { storeId, userId, gameType: CATCH_GAME, playedAt: { gte: start, lt: end } },
      orderBy: { playedAt: 'desc' },
    })
    if (play) {
      const coupon = play.couponId
        ? await tx.coupon.findFirst({ where: { id: play.couponId, storeId }, select: { code: true, endAt: true } })
        : null
      return {
        alreadyClaimed: true as const,
        percent: play.percent,
        code: coupon?.code ?? null,
        endAt: coupon?.endAt?.toISOString() ?? null,
      }
    }
    if (percent === 0) return { alreadyClaimed: false as const, percent: 0, code: null, endAt: null }

    const endAt = new Date()
    endAt.setUTCDate(endAt.getUTCDate() + 7)
    const coupon = await tx.coupon.create({
      data: {
        storeId,
        code: couponCode(percent, userId),
        description: `Gift Catch: ${percent}% off (score ${score}, 1 use)`,
        type: 'PERCENTAGE',
        value: percent,
        minOrderAmount: 0,
        maxDiscount: null,
        usageLimit: 1,
        endAt,
        isActive: true,
        applicability: 'ALL',
        createdByUserId: userId,
      },
    })
    await tx.promoGamePlay.create({
      data: { storeId, userId, gameType: CATCH_GAME, couponId: coupon.id, percent },
    })
    return { alreadyClaimed: false as const, percent, code: coupon.code, endAt: endAt.toISOString() }
  })
}
