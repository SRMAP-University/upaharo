import { NextRequest, NextResponse } from 'next/server'
import { checkInventoryPin, isValidPin, requireInventoryAccess, setInventoryPin } from '@/lib/inventory-lock'

/** Change the PIN: { currentPin, newPin }. Needs inventory unlocked and the current PIN. */
export async function POST(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access) {
    return NextResponse.json({ error: access.error === 'locked' ? 'Inventory is locked' : 'Unauthorized' }, { status: access.error === 'locked' ? 423 : 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (!(await checkInventoryPin(String(body?.currentPin ?? '')))) {
    return NextResponse.json({ error: 'Current PIN is wrong' }, { status: 403 })
  }
  const newPin = String(body?.newPin ?? '')
  if (!isValidPin(newPin)) {
    return NextResponse.json({ error: 'New PIN must be 4 to 8 digits' }, { status: 400 })
  }
  await setInventoryPin(newPin)
  return NextResponse.json({ ok: true })
}
