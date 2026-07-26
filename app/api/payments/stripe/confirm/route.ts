import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/request-auth'
import { applyStripeCheckoutSessionToOrder } from '@/lib/stripe-order-payment'

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderId = String(body.orderId || '')
    const sessionId = String(body.sessionId || body.session_id || '')

    if (!orderId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing orderId or sessionId' },
        { status: 400 }
      )
    }

    const result = await applyStripeCheckoutSessionToOrder({
      orderId,
      sessionId,
      expectedUserId: userId,
    })

    return NextResponse.json({
      orderId: result.orderId,
      paymentStatus: result.paymentStatus,
    })
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 500
    console.error('Error confirming Stripe payment:', error)
    return NextResponse.json(
      {
        error: 'Failed to confirm Stripe payment',
        details: error?.message || 'Unknown error',
      },
      { status }
    )
  }
}
