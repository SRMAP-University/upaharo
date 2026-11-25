import { NextRequest, NextResponse } from 'next/server'
import { emailSetup, sendEmailWithResult } from '@/lib/email'
import { requireAdmin } from '@/lib/request-auth'

/** Admin → Settings → Email: how email is set up (GET), and a test send (POST { to? }). */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(emailSetup(), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const wanted = String(body?.to || '').trim()
  const to = wanted || admin.email
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ ok: false, via: 'none', error: 'Enter a valid email address' }, { status: 400 })
  }
  const result = await sendEmailWithResult({
    to,
    subject: 'Upaharo test email',
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
      <h2>Email is working</h2>
      <p>This test was sent from Upaharo admin, so seller and admin emails can now be delivered.</p>
    </div>`,
  })
  return NextResponse.json({ ...result, to }, { status: result.ok ? 200 : 502 })
}
