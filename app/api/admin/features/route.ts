import { NextRequest, NextResponse } from 'next/server'
import { FEATURE_TEMPLATES, normalizeFeatureInput, RUNTIME_VERSION } from '@/lib/app-features'
import {
  insertFeature,
  invalidateStoreFeatures,
  isUniqueKeyError,
  listFeaturesForAdmin,
} from '@/lib/app-features-store'
import { requireAdmin } from '@/lib/request-auth'
import { resolveAdminStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const { features, tableReady } = await listFeaturesForAdmin(storeContext.store)
    return NextResponse.json({ features, tableReady, templates: FEATURE_TEMPLATES, runtime: RUNTIME_VERSION })
  } catch (error) {
    console.error('Error fetching app features:', error)
    return NextResponse.json({ error: 'Failed to fetch features' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const storeContext = await resolveAdminStoreContext()
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    let feature
    try {
      feature = normalizeFeatureInput(await request.json())
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid feature' }, { status: 400 })
    }

    try {
      const id = await insertFeature(storeContext.store.id, feature)
      await invalidateStoreFeatures(storeContext.slug)
      return NextResponse.json({ id }, { status: 201 })
    } catch (error) {
      if (isUniqueKeyError(error)) {
        return NextResponse.json({ error: `A feature with key "${feature.key}" already exists` }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error('Error creating app feature:', error)
    return NextResponse.json({ error: 'Failed to create feature' }, { status: 500 })
  }
}
