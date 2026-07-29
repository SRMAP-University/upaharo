import { NextRequest, NextResponse } from 'next/server'
import { getAppSettings } from '@/lib/app-settings'
import { resolveStoreContext } from '@/lib/store-context'

export async function GET(request: NextRequest) {
  try {
    const storeContext = await resolveStoreContext(request)
    if (!storeContext) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    const settings = await getAppSettings(storeContext.store)
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching public app settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}
