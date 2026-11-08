import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { confirmInventoryPin, requireInventoryAccess } from '@/lib/inventory-lock'
import { cleanSheetData } from '@/lib/sales-sheet'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

function denied(error: 'signed-out' | 'locked') {
  return error === 'locked'
    ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

const SELECT = { id: true, name: true, note: true, data: true, createdAt: true, updatedAt: true } as const

/** One sheet with everything in it. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const { id } = await params

  const sheet = await prisma.salesSheet.findFirst({ where: { id, storeId: storeContext.store.id }, select: SELECT })
  if (!sheet) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
  return NextResponse.json({ ...sheet, data: cleanSheetData(sheet.data) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** Save a sheet: { name?, note?, data? } (data replaces what was there). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const { id } = await params

  const existing = await prisma.salesSheet.findFirst({ where: { id, storeId: storeContext.store.id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const update: { name?: string; note?: string; data?: ReturnType<typeof cleanSheetData> } = {}
  if (body?.name !== undefined) {
    const name = String(body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (!name) return NextResponse.json({ error: 'The sheet needs a name' }, { status: 400 })
    update.name = name
  }
  if (body?.note !== undefined) update.note = String(body.note ?? '').trim().slice(0, 500)
  if (body?.data !== undefined) update.data = cleanSheetData(body.data)

  const sheet = await prisma.salesSheet.update({ where: { id }, data: update, select: SELECT })
  return NextResponse.json({ ...sheet, data: cleanSheetData(sheet.data) })
}

/** Delete a sheet: { pin }. The PIN is asked again. Real orders aren't touched. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const pinError = await confirmInventoryPin(access.admin.id, body?.pin)
  if (pinError) return NextResponse.json({ error: pinError.error }, { status: pinError.status })

  const result = await prisma.salesSheet.deleteMany({ where: { id, storeId: storeContext.store.id } })
  if (result.count === 0) return NextResponse.json({ error: 'Sheet not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
