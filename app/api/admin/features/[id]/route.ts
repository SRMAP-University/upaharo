import { NextRequest, NextResponse } from 'next/server'
import { normalizeFeatureInput } from '@/lib/app-features'
import {
  deleteFeature,
  findFeature,
  invalidateStoreFeatures,
  isUniqueKeyError,
  updateFeature,
} from '@/lib/app-features-store'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params

    const existing = await findFeature(storeContext.store.id, id)
    if (!existing) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })

    let feature
    try {
      feature = normalizeFeatureInput(await request.json())
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid feature' }, { status: 400 })
    }
    // The app looks built-ins up by key, so keep it stable.
    if (existing.builtIn && feature.key !== existing.key) {
      return NextResponse.json({ error: 'Built-in features keep their key' }, { status: 400 })
    }

    try {
      await updateFeature(storeContext.store.id, id, feature)
    } catch (error) {
      if (isUniqueKeyError(error)) {
        return NextResponse.json({ error: `A feature with key "${feature.key}" already exists` }, { status: 409 })
      }
      throw error
    }
    await invalidateStoreFeatures(storeContext.slug)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating app feature:', error)
    return NextResponse.json({ error: 'Failed to update feature' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const { id } = await params

    const existing = await findFeature(storeContext.store.id, id)
    if (!existing) return NextResponse.json({ error: 'Feature not found' }, { status: 404 })
    if (existing.builtIn) {
      return NextResponse.json({ error: 'Built-in features can be turned off, not deleted' }, { status: 400 })
    }

    await deleteFeature(storeContext.store.id, id)
    await invalidateStoreFeatures(storeContext.slug)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting app feature:', error)
    return NextResponse.json({ error: 'Failed to delete feature' }, { status: 500 })
  }
}
