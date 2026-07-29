import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/request-auth'
import {
  ADMIN_STORE_COOKIE,
  DEFAULT_STORE_SLUG,
  resolveAdminStoreSlug,
} from '@/lib/store-context'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [stores, selectedSlug] = await Promise.all([
    prisma.store.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
    resolveAdminStoreSlug(),
  ])

  return NextResponse.json({ stores, selectedSlug })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const slug = String(body?.slug || '').trim().toLowerCase()
  if (!/^[a-z0-9-]{1,48}$/.test(slug)) {
    return NextResponse.json({ error: 'Invalid store' }, { status: 400 })
  }

  const store = await prisma.store.findFirst({
    where: { slug, isActive: true },
    select: { slug: true, name: true },
  })
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const response = NextResponse.json({ store })
  response.cookies.set({
    name: ADMIN_STORE_COOKIE,
    value: store.slug || DEFAULT_STORE_SLUG,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
