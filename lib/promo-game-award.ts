import { prisma } from '@/lib/prisma'

export const PROMO_GAME_TYPES = ['scratch', 'flip', 'lucky'] as const
export type PromoGameType = (typeof PROMO_GAME_TYPES)[number]

export function isPromoGameType(value: string): value is PromoGameType {
  return (PROMO_GAME_TYPES as readonly string[]).includes(value)
}

export const PROMO_SEGMENTS = [
  { percent: 5, weight: 28 },
  { percent: 10, weight: 24 },
  { percent: 15, weight: 20 },
  { percent: 20, weight: 14 },
  { percent: 25, weight: 9 },
  { percent: 30, weight: 5 },
] as const

const GAME_LABELS: Record<PromoGameType, string> = {
  scratch: 'Scratch & Win',
  flip: 'Flip Match',
  lucky: 'Lucky Pick',
}

const CODE_PREFIX: Record<PromoGameType, string> = {
  scratch: 'SCR',
  flip: 'FLIP',
  lucky: 'LCK',
}

export function dayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

export function pickPromoPercent(): number {
  const total = PROMO_SEGMENTS.reduce((sum, s) => sum + s.weight, 0)
  let roll = Math.random() * total
  for (const segment of PROMO_SEGMENTS) {
    roll -= segment.weight
    if (roll <= 0) return segment.percent
  }
  return PROMO_SEGMENTS[0].percent
}

function randomCode(game: PromoGameType, percent: number, userId: string) {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'USER'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${CODE_PREFIX[game]}${percent}-${tail}${rand}`
}

export async function todaysPromoGamePlay(storeId: string, userId: string, gameType: PromoGameType) {
  const { start, end } = dayBounds()
  return prisma.promoGamePlay.findFirst({
    where: {
      storeId,
      userId,
      gameType,
      playedAt: { gte: start, lt: end },
    },
    orderBy: { playedAt: 'desc' },
  })
}

export async function promoGameStatusPayload(
  storeId: string,
  userId: string,
  gameType: PromoGameType
) {
  const play = await todaysPromoGamePlay(storeId, userId, gameType)
  const segments = PROMO_SEGMENTS.map((s) => s.percent)
  if (!play) {
    return { canPlay: true, gameType, segments }
  }

  let code: string | null = null
  let endAt: string | null = null
  if (play.couponId) {
    const coupon = await prisma.coupon.findFirst({
      where: { id: play.couponId, storeId },
      select: { code: true, endAt: true },
    })
    code = coupon?.code ?? null
    endAt = coupon?.endAt?.toISOString() ?? null
  }

  return {
    canPlay: false,
    gameType,
    percent: play.percent,
    code,
    endAt,
    segments,
  }
}

/** Award a single-use % coupon and record today's play for this game. */
export async function awardPromoGame(
  storeId: string,
  userId: string,
  gameType: PromoGameType
) {
  const existing = await todaysPromoGamePlay(storeId, userId, gameType)
  if (existing) {
    const status = await promoGameStatusPayload(storeId, userId, gameType)
    return { ...status, alreadyPlayed: true as const }
  }

  const percent = pickPromoPercent()
  const code = randomCode(gameType, percent, userId)
  const endAt = new Date()
  endAt.setUTCDate(endAt.getUTCDate() + 7)

  const coupon = await prisma.coupon.create({
    data: {
      storeId,
      code,
      description: `${GAME_LABELS[gameType]} — ${percent}% off (1 use)`,
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

  await prisma.promoGamePlay.create({
    data: {
      storeId,
      userId,
      gameType,
      couponId: coupon.id,
      percent,
    },
  })

  return {
    canPlay: false,
    alreadyPlayed: false as const,
    gameType,
    percent,
    code: coupon.code,
    type: 'PERCENTAGE' as const,
    endAt: endAt.toISOString(),
    segments: PROMO_SEGMENTS.map((s) => s.percent),
  }
}
