import { NextRequest, NextResponse } from 'next/server'
import { activeCakeConfig } from '@/lib/cake-builder'
import { getCakeBuilderConfig, isCakeBuilderLive } from '@/lib/cake-builder-server'
import { resolveStoreContext } from '@/lib/store-context'
import { storeAwareJsonHeaders } from '@/lib/store-cache-headers'

/** Options and prices for the Build Your Own Cake page (active ones only). */
export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    const config = await getCakeBuilderConfig(storeContext.store.id)
    const headers = storeAwareJsonHeaders({ 'Cache-Control': 'private, no-store' })
    if (!isCakeBuilderLive(config)) {
      return NextResponse.json({ enabled: false }, { headers })
    }
    return NextResponse.json({ enabled: true, config: activeCakeConfig(config) }, { headers })
  } catch (error) {
    console.error('Error loading cake builder:', error)
    return NextResponse.json({ error: 'Failed to load cake options' }, { status: 500 })
  }
}
