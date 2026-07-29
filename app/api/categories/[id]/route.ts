import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwareJsonHeaders } from '@/lib/store-cache-headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { store } = storeContext

    const category = await prisma.category.findFirst({
      where: { id, storeId: store.id },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(category, { headers: storeAwareJsonHeaders() })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category' },
      { status: 500 }
    )
  }
}
