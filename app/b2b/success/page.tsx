'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import B2BHeader from '@/components/b2b/B2BHeader'

function SuccessBody() {
  const params = useSearchParams()
  const orderNumber = params.get('order') || ''

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-wine/10 text-3xl">
        ✓
      </div>
      <h1 className="font-display text-2xl font-semibold text-ink">Wholesale order placed</h1>
      {orderNumber ? (
        <p className="mt-2 text-sm text-ink/60">
          Order <span className="font-semibold text-wine">{orderNumber}</span>
        </p>
      ) : null}
      <p className="mt-3 text-sm text-ink/50">
        Our sales team will confirm availability, delivery, and payment. You can track this order
        under My orders with the email you used at checkout.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/b2b/orders"
          className="rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-deep"
        >
          View my orders
        </Link>
        <Link
          href="/b2b"
          className="rounded-full border border-wine/20 px-5 py-2.5 text-sm font-semibold text-wine"
        >
          Back to catalog
        </Link>
      </div>
    </main>
  )
}

export default function B2BSuccessPage() {
  return (
    <>
      <B2BHeader />
      <Suspense fallback={<div className="p-16 text-center text-ink/40">Loading…</div>}>
        <SuccessBody />
      </Suspense>
    </>
  )
}
