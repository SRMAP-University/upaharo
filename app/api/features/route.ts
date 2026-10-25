import { NextRequest, NextResponse } from 'next/server'
import { FEATURE_PLATFORMS, isFeatureLive, RUNTIME_VERSION, type FeaturePlatform } from '@/lib/app-features'
import { getStoreFeatures } from '@/lib/app-features-store'
import { resolveStoreContext } from '@/lib/store-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Features live for this device.
 * GET /api/features?platform=android&appVersion=1.0.0&runtime=1
 * → { runtime, features: [{ id, key, type, config, updatedAt, ... }] }
 */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const params = request.nextUrl.searchParams
    const platformParam = params.get('platform') as FeaturePlatform | null
    const platform = platformParam && FEATURE_PLATFORMS.includes(platformParam) ? platformParam : 'web'
    const runtime = parseInt(params.get('runtime') || '0', 10) || 0
    const appVersion = params.get('appVersion')

    const all = await getStoreFeatures(storeContext.store)
    const features = all
      .filter((feature) => isFeatureLive(feature, { platform, runtime, appVersion }))
      .map(({ id, key, name, type, config, priority, updatedAt }) => ({
        id,
        key,
        name,
        type,
        config,
        priority,
        updatedAt: updatedAt ?? null,
      }))

    return NextResponse.json(
      { runtime: RUNTIME_VERSION, features },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (error) {
    console.error('Error loading app features:', error)
    return NextResponse.json({ error: 'Failed to load features' }, { status: 500 })
  }
}
