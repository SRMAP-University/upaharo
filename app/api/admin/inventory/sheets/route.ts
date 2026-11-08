import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireInventoryAccess } from '@/lib/inventory-lock'
import { cleanSheetData, sheetTotals } from '@/lib/sales-sheet'
import { resolveAdminStoreContext } from '@/lib/store-context'

export const dynamic = 'force-dynamic'

function denied(error: 'signed-out' | 'locked') {
  return error === 'locked'
    ? NextResponse.json({ error: 'Inventory is locked', locked: true }, { status: 423 })
    : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Custom sales sheets, newest first, each with its totals. */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const sheets = await prisma.salesSheet.findMany({
    where: { storeId: storeContext.store.id },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: { id: true, name: true, note: true, data: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json(
    {
      sheets: sheets.map(({ data, ...sheet }) => ({ ...sheet, totals: sheetTotals(cleanSheetData(data)) })),
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}

/** Start a sheet: { name, note?, copyFrom? (another sheet's id) }. */
export async function POST(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) return denied(access.error)
  const storeContext = await resolveAdminStoreContext()
  if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const storeId = storeContext.store.id

  const body = await request.json().catch(() => ({}))
  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)
  if (!name) return NextResponse.json({ error: 'Give the sheet a name, e.g. Tihar 2026' }, { status: 400 })
  const note = String(body?.note ?? '').trim().slice(0, 500)

  let data = cleanSheetData({})
  if (body?.copyFrom) {
    const source = await prisma.salesSheet.findFirst({ where: { id: String(body.copyFrom), storeId }, select: { data: true } })
    if (!source) return NextResponse.json({ error: 'Sheet to copy not found' }, { status: 404 })
    data = cleanSheetData(source.data)
  }

  const sheet = await prisma.salesSheet.create({
    data: { storeId, name, note, data },
    select: { id: true, name: true, note: true, data: true, createdAt: true, updatedAt: true },
  })
  return NextResponse.json({ ...sheet, data: cleanSheetData(sheet.data) }, { status: 201 })
}
