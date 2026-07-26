import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyReminder } from '@/lib/notifications'

/**
 * Daily reminder job: birthdays & anniversaries within the next N days.
 * Secure with CRON_SECRET: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const auth = request.headers.get('authorization') || ''
      if (auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const daysAhead = Math.min(Number(process.env.REMINDER_DAYS_AHEAD || 3), 14)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dayEnd = new Date(today)
    dayEnd.setHours(23, 59, 59, 999)

    const recipients = await prisma.giftRecipient.findMany({
      where: {
        OR: [{ birthDate: { not: null } }, { anniversary: { not: null } }],
      },
      select: {
        id: true,
        userId: true,
        name: true,
        birthDate: true,
        anniversary: true,
      },
    })

    const todaysReminders = await prisma.appNotification.findMany({
      where: {
        type: 'REMINDER',
        createdAt: { gte: today, lte: dayEnd },
      },
      select: { userId: true, data: true },
    })

    const alreadySent = new Set(
      todaysReminders.map((n) => {
        const data = (n.data || {}) as Record<string, unknown>
        return `${n.userId}:${data.recipientId}:${data.kind}`
      })
    )

    let sent = 0

    for (const r of recipients) {
      const events: { kind: string; date: Date }[] = []
      if (r.birthDate) events.push({ kind: 'birthday', date: r.birthDate })
      if (r.anniversary) events.push({ kind: 'anniversary', date: r.anniversary })

      for (const event of events) {
        const next = nextOccurrence(event.date, today)
        const diffDays = Math.round((next.getTime() - today.getTime()) / 86400000)
        if (diffDays < 0 || diffDays > daysAhead) continue

        const key = `${r.userId}:${r.id}:${event.kind}`
        if (alreadySent.has(key)) continue

        const when =
          diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`
        const label = event.kind === 'birthday' ? 'birthday' : 'anniversary'

        await notifyReminder({
          userId: r.userId,
          title: `${r.name}'s ${label} ${when}`,
          body: `Send a thoughtful gift for their ${label}. Browse ideas in Upaharo.`,
          data: {
            recipientId: r.id,
            kind: event.kind,
            route: '/home',
          },
        })
        alreadySent.add(key)
        sent += 1
      }
    }

    return NextResponse.json({ ok: true, sent, checked: recipients.length })
  } catch (error) {
    console.error('Reminder cron error:', error)
    return NextResponse.json({ error: 'Reminder job failed' }, { status: 500 })
  }
}

function nextOccurrence(original: Date, from: Date): Date {
  const next = new Date(from.getFullYear(), original.getMonth(), original.getDate())
  if (next < from) {
    next.setFullYear(from.getFullYear() + 1)
  }
  return next
}
