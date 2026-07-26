'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/store/cart'

type ReturnState = 'verifying' | 'success' | 'processing' | 'failed' | 'error'

export default function StripeReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clearCart = useCartStore((state) => state.clearCart)
  const [state, setState] = useState<ReturnState>('verifying')
  const [message, setMessage] = useState('Verifying your payment...')

  useEffect(() => {
    const orderId = searchParams.get('orderId')
    const sessionId = searchParams.get('session_id')

    if (!orderId || !sessionId) {
      setState('error')
      setMessage('Missing payment details. Please check your orders page.')
      return
    }

    let isActive = true

    async function confirmPayment() {
      try {
        const response = await fetch('/api/payments/stripe/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            sessionId,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.details || data.error || 'Failed to confirm payment')
        }

        if (!isActive) {
          return
        }

        if (data.paymentStatus === 'COMPLETED') {
          clearCart()
          setState('success')
          setMessage('Payment completed. Redirecting to your orders...')
          window.setTimeout(() => {
            router.replace('/orders')
          }, 1200)
          return
        }

        if (data.paymentStatus === 'PENDING') {
          setState('processing')
          setMessage('Your payment is still processing. We will keep your order updated.')
          window.setTimeout(() => {
            router.replace(`/orders/${orderId}`)
          }, 1800)
          return
        }

        setState('failed')
        setMessage('Payment was not completed. You can try again from checkout.')
      } catch (error: any) {
        if (!isActive) {
          return
        }
        setState('error')
        setMessage(error?.message || 'Failed to verify payment')
      }
    }

    void confirmPayment()

    return () => {
      isActive = false
    }
  }, [clearCart, router, searchParams])

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md rounded-[22px] border border-wine/10 bg-white p-6 text-center shadow-[0_24px_60px_-46px_rgba(43,29,34,0.5)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-soft text-wine">
          {state === 'failed' || state === 'error' ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : state === 'success' ? (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
        </div>

        <h1 className="font-display text-xl font-semibold text-ink">
          {state === 'success'
            ? 'Payment Successful'
            : state === 'processing'
              ? 'Payment Processing'
              : state === 'failed'
                ? 'Payment Failed'
                : state === 'error'
                  ? 'Verification Error'
                  : 'Verifying Payment'}
        </h1>

        <p className="mt-3 text-sm text-ink/55">{message}</p>

        {(state === 'failed' || state === 'error') && (
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href="/checkout"
              className="rounded-full bg-wine px-5 py-2 text-sm font-semibold text-white hover:bg-wine-deep transition-colors"
            >
              Back to Checkout
            </Link>
            <Link
              href="/orders"
              className="rounded-full border border-wine/20 bg-white px-5 py-2 text-sm font-semibold text-wine hover:bg-cream transition-colors"
            >
              View Orders
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
