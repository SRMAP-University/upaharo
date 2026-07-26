'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import B2BHeader from '@/components/b2b/B2BHeader'
import { useB2BCartStore } from '@/lib/store/b2b-cart'
import { formatPrice } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/image-url'

export default function B2BCartPage() {
  const items = useB2BCartStore((s) => s.items)
  const updateQuantity = useB2BCartStore((s) => s.updateQuantity)
  const removeItem = useB2BCartStore((s) => s.removeItem)
  const getTotalPrice = useB2BCartStore((s) => s.getTotalPrice)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const total = mounted ? getTotalPrice() : 0

  return (
    <>
      <B2BHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 pb-20">
        <h1 className="font-display text-2xl font-semibold text-ink">Wholesale cart</h1>
        <p className="mt-1 text-sm text-ink/50">Separate from the retail shop — wholesale prices only</p>

        {!mounted ? (
          <div className="mt-8 animate-pulse rounded-2xl bg-white h-40 border border-wine/10" />
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-wine/10 bg-white px-6 py-14 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-display text-lg font-semibold text-ink">Your cart is empty</p>
            <Link
              href="/b2b"
              className="mt-5 inline-flex rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-deep"
            >
              Browse catalog
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 rounded-2xl border border-wine/10 bg-white p-3"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#EDE6E0]">
                  <Image
                    src={resolveImageUrl(item.image)}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium text-ink">{item.name}</h2>
                  <p className="text-sm font-semibold text-wine mt-0.5">
                    {formatPrice(item.price)} <span className="font-normal text-ink/40">/ unit</span>
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center overflow-hidden rounded-full bg-wine text-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8 text-lg leading-none hover:bg-wine-deep"
                      >
                        −
                      </button>
                      <span className="min-w-[28px] text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 text-lg leading-none hover:bg-wine-deep"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-semibold text-ink/40 hover:text-red-600"
                    >
                      Remove
                    </button>
                    <p className="ml-auto text-sm font-semibold text-ink">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-wine/10 bg-white p-4">
              <div className="flex justify-between text-sm">
                <span className="text-ink/55">Subtotal</span>
                <span className="font-semibold text-ink">{formatPrice(total)}</span>
              </div>
              <p className="mt-1 text-xs text-ink/40">Delivery fee confirmed at checkout / by sales</p>
              <Link
                href="/b2b/checkout"
                className="mt-4 flex w-full items-center justify-center rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep"
              >
                Proceed to checkout
              </Link>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
