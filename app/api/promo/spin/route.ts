import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'

const SEGMENTS = [
  { percent: 5, weight: 28 },
  { percent: 10, weight: 24 },
  { percent: 15, weight: 20 },
  { percent: 20, weight: 14 },
  { percent: 25, weight: 9 },
  { percent: 30, weight: 5 },
] as const

function dayBounds(now = new Date()) {
  // Asia/Kathmandu ≈ UTC+5:45 — use UTC calendar day for simplicity + consistency.
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start, end }
}

function pickPercent(): number {
  const total = SEGMENTS.reduce((sum, s) => sum + s.weight, 0)
  let roll = Math.random() * total
  for (const segment of SEGMENTS) {
    roll -= segment.weight
    if (roll <= 0) return segment.percent
  }
  return SEGMENTS[0].percent
}

function randomCode(percent: number, userId: string) {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'USER'
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SPIN${percent}-${tail}${rand}`
}

async function todaysPlay(userId: string) {
  const { start, end } = dayBounds()
  return prisma.spinPlay.findFirst({
    where: {
      userId,
      playedAt: { gte: start, lt: end },
    },
    orderBy: { playedAt: 'desc' },
  })
}

/** GET — can the user spin today? Returns today's prize if already played. */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const play = await todaysPlay(userId)
    if (!play) {
      return NextResponse.json({
        canSpin: true,
        segments: SEGMENTS.map((s) => s.percent),
      })
    }

    let code: string | null = null
    if (play.couponId) {
      const coupon = await prisma.coupon.findUnique({
        where: { id: play.couponId },
        select: { code: true, value: true, endAt: true },
      })
      code = coupon?.code ?? null
      return NextResponse.json({
        canSpin: false,
        percent: play.percent,
        code,
        endAt: coupon?.endAt?.toISOString() ?? null,
        segments: SEGMENTS.map((s) => s.percent),
      })
    }

    return NextResponse.json({
      canSpin: false,
      percent: play.percent,
      code: null,
      segments: SEGMENTS.map((s) => s.percent),
    })
  } catch (error) {
    console.error('GET /api/promo/spin', error)
    return NextResponse.json({ error: 'Failed to load spin status' }, { status: 500 })
  }
}

/** POST — spin once per UTC day; awards a single-use PERCENTAGE coupon. */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 })
    }

    const existing = await todaysPlay(userId)
    if (existing) {
      let code: string | null = null
      let endAt: string | null = null
      if (existing.couponId) {
        const coupon = await prisma.coupon.findUnique({
          where: { id: existing.couponId },
          select: { code: true, endAt: true },
        })
        code = coupon?.code ?? null
        endAt = coupon?.endAt?.toISOString() ?? null
      }
      return NextResponse.json({
        alreadyPlayed: true,
        canSpin: false,
        percent: existing.percent,
        code,
        endAt,
        segments: SEGMENTS.map((s) => s.percent),
      })
    }

    const percent = pickPercent()
    const code = randomCode(percent, userId)
    const endAt = new Date()
    endAt.setUTCDate(endAt.getUTCDate() + 7)

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description: `Spin & Win — ${percent}% off (1 use)`,
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

    await prisma.spinPlay.create({
      data: {
        userId,
        couponId: coupon.id,
        percent,
      },
    })

    return NextResponse.json({
      canSpin: false,
      percent,
      code: coupon.code,
      type: 'PERCENTAGE',
      endAt: endAt.toISOString(),
      segments: SEGMENTS.map((s) => s.percent),
    })
  } catch (error) {
    console.error('POST /api/promo/spin', error)
    return NextResponse.json({ error: 'Spin failed' }, { status: 500 })
  }
}
