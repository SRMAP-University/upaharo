import { NextRequest, NextResponse } from 'next/server'
import { cakeConfigProblems } from '@/lib/cake-builder'
import { getCakeBuilderConfig, saveCakeBuilderConfig } from '@/lib/cake-builder-server'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const config = await getCakeBuilderConfig(storeContext.store.id)
    return NextResponse.json(
      { config, saved: Boolean(config.updatedAt), problems: cakeConfigProblems(config) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('Error loading cake builder settings:', error)
    return NextResponse.json({ error: 'Failed to load cake builder settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || !('config' in body)) {
      return NextResponse.json({ error: 'Send { config }' }, { status: 400 })
    }

    const config = await saveCakeBuilderConfig(storeContext.store.id, (body as { config: unknown }).config)
    const problems = cakeConfigProblems(config)
    return NextResponse.json({ config, saved: true, problems })
  } catch (error) {
    console.error('Error saving cake builder settings:', error)
    return NextResponse.json({ error: 'Failed to save cake builder settings' }, { status: 500 })
  }
}
