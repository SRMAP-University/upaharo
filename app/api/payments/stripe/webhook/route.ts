import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { applyStripeCheckoutSessionToOrder } from '@/lib/stripe-order-payment'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripe()

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error: any) {
    console.error('Stripe webhook signature verification failed:', error?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.expired' ||
      event.type === 'checkout.session.async_payment_failed'
    ) {
      const session = event.data.object
      const orderId =
        (typeof session.metadata?.orderId === 'string' && session.metadata.orderId) ||
        session.client_reference_id ||
        ''

      if (orderId && session.id) {
        await applyStripeCheckoutSessionToOrder({
          orderId,
          sessionId: session.id,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('Stripe webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error?.message },
      { status: 500 }
    )
  }
}
