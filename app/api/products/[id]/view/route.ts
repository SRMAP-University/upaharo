import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/request-auth'
import { resolveStoreContext } from '@/lib/store-context'

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext
    const body = await request.json().catch(() => ({}))
    const userId = await resolveUserId(request)
    const sessionId = String(body?.sessionId || '').trim() || null

    if (userId || sessionId) {
      const product = await prisma.product.findFirst({
        where: { id, storeId: store.id },
        select: { id: true },
      })
      if (product) {
        await prisma.productViewEvent.create({
          data: { storeId: store.id, productId: id, userId: userId || null, sessionId },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error tracking product view:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
