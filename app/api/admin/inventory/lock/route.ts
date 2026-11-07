import { NextRequest, NextResponse } from 'next/server'
import {
  checkInventoryPin,
  clearUnlockCookie,
  clearWrongPins,
  hasInventoryPin,
  pinLockoutSeconds,
  recordWrongPin,
  requireInventoryAccess,
  setUnlockCookie,
} from '@/lib/inventory-lock'
import { requireAdmin } from '@/lib/request-auth'

export const dynamic = 'force-dynamic'

/** Whether inventory is unlocked for this admin. */
export async function GET(request: NextRequest) {
  const access = await requireInventoryAccess(request)
  if ('error' in access && access.error === 'signed-out') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = await requireAdmin(request)
  return NextResponse.json({
    unlocked: !('error' in access),
    pinSet: await hasInventoryPin(),
    lockoutSeconds: admin ? await pinLockoutSeconds(admin.id) : 0,
  })
}

/** Unlock with the PIN: { pin }. Five wrong tries lock it for 15 minutes. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wait = await pinLockoutSeconds(admin.id)
  if (wait > 0) {
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${Math.ceil(wait / 60)} min.`, lockoutSeconds: wait },
      { status: 429 }
    )
  }
  if (!(await hasInventoryPin())) {
    return NextResponse.json({ error: 'No inventory PIN is set yet.' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  if (!(await checkInventoryPin(String(body?.pin ?? '')))) {
    const left = await recordWrongPin(admin.id)
    return NextResponse.json(
      { error: left > 0 ? `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong PIN. Locked for 15 minutes.' },
      { status: 403 }
    )
  }

  await clearWrongPins(admin.id)
  const response = NextResponse.json({ unlocked: true })
  setUnlockCookie(response, admin.id)
  return response
}

/** Lock again. */
export async function DELETE() {
  const response = NextResponse.json({ unlocked: false })
  clearUnlockCookie(response)
  return response
}
