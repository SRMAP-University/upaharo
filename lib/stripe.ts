import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-06-24.dahlia',
      typescript: true,
    })
  }

  return stripeClient
}

export function getStripeCurrency(): string {
  return (process.env.STRIPE_CURRENCY || 'npr').toLowerCase()
}

function randomSuffix(length = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

export type CreateStripeCheckoutSessionInput = {
  orderId: string
  orderNumber: string
  userId: string
  amountMajor: number
  customerEmail?: string | null
  customerName?: string | null
  successUrl: string
  cancelUrl: string
}

export async function createStripeCheckoutSession(
  input: CreateStripeCheckoutSessionInput
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  const currency = getStripeCurrency()
  const amountInMinor = Math.round(Number(input.amountMajor) * 100)

  if (!Number.isFinite(amountInMinor) || amountInMinor < 1) {
    throw new Error('Invalid payment amount')
  }

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: input.customerEmail || undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.orderId,
    integration_identifier: `upaharo_checkout_${randomSuffix()}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountInMinor,
          product_data: {
            name: `Upaharo order ${input.orderNumber}`,
            description: 'Gift delivery order',
          },
        },
      },
    ],
    metadata: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      userId: input.userId,
      customerName: input.customerName || '',
    },
  })
}

export async function retrieveStripeCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.retrieve(sessionId)
}

export function mapStripeSessionToPaymentStatus(
  session: Stripe.Checkout.Session
): 'COMPLETED' | 'FAILED' | 'PENDING' {
  if (session.status === 'expired') {
    return 'FAILED'
  }

  if (session.payment_status === 'paid') {
    return 'COMPLETED'
  }

  if (session.status === 'complete' && session.payment_status === 'unpaid') {
    return 'PENDING'
  }

  return 'PENDING'
}
