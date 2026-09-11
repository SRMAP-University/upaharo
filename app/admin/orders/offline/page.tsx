'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPriceNoDecimals } from '@/lib/utils'

type CatalogProduct = {
  id: string
  name: string
  price: number
  discount?: number | null
  image?: string | null
}

type Line = {
  productId: string
  name: string
  price: number
  quantity: number
}

const CHANNELS = [
  { id: 'WALK_IN', label: 'Walk-in' },
  { id: 'PHONE', label: 'Phone' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'OTHER', label: 'Other' },
] as const

function unitPrice(product: CatalogProduct) {
  const discount = Number(product.discount) || 0
  return discount > 0 ? product.price * (1 - discount / 100) : product.price
}

export default function AdminOfflineOrderPage() {
  const router = useRouter()
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['id']>('PHONE')
  const [fulfillmentType, setFulfillmentType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('Kathmandu')
  const [landmark, setLandmark] = useState('')
  const [discount, setDiscount] = useState('0')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE' | 'CARD'>('CASH')
  const [paid, setPaid] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
  const discountAmt = Math.min(Math.max(0, Number(discount) || 0), subtotal)
  const fee = fulfillmentType === 'PICKUP' ? 0 : Math.max(0, Number(deliveryFee) || 0)
  const total = Math.max(0, subtotal - discountAmt + fee)

  const searchProducts = async () => {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      const res = await fetch(
        `/api/admin/products?search=${encodeURIComponent(q)}&availability=available&limit=20`
      )
      const data = await res.json()
      setResults(Array.isArray(data.products) ? data.products : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const addProduct = (product: CatalogProduct) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id)
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line
        )
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: unitPrice(product), quantity: 1 },
      ]
    })
    setQuery('')
    setResults([])
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (lines.length === 0) {
      setError('Add at least one product')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          fulfillmentType,
          customerName,
          customerPhone,
          note,
          discount: discountAmt,
          deliveryFee: fee,
          paymentMethod,
          paymentStatus: paid || paymentMethod !== 'CASH' ? 'COMPLETED' : 'PENDING',
          items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          address:
            fulfillmentType === 'DELIVERY'
              ? { street, city, landmark }
              : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create order')
        return
      }
      router.push('/admin/orders')
    } catch {
      setError('Failed to create order')
    } finally {
      setSaving(false)
    }
  }

  const channelHint = useMemo(() => {
    if (channel === 'WALK_IN') return 'Counter / shop sale taken in person.'
    if (channel === 'PHONE') return 'Order taken on a phone call.'
    if (channel === 'WHATSAPP') return 'Order taken on WhatsApp.'
    return 'Order placed outside the Upaharo app or website.'
  }, [channel])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="text-sm font-medium text-wine hover:text-wine-deep">
            ← Orders
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">New offline order</h1>
          <p className="mt-1 text-sm text-ink/55">{channelHint}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-[22px] border border-wine/10 bg-white p-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setChannel(item.id)
                if (item.id === 'WALK_IN') setFulfillmentType('PICKUP')
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                channel === item.id ? 'bg-wine text-white' : 'bg-cream text-ink/70 hover:bg-cream-deep'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-ink">
            Customer name
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              placeholder="Optional for walk-in"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Phone
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              placeholder="98xxxxxxxx"
            />
          </label>
        </div>

        <div className="flex gap-2">
          {(['DELIVERY', 'PICKUP'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFulfillmentType(type)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                fulfillmentType === type ? 'bg-blush-soft text-blush' : 'bg-cream text-ink/70'
              }`}
            >
              {type === 'DELIVERY' ? 'Delivery' : 'Pickup'}
            </button>
          ))}
        </div>

        {fulfillmentType === 'DELIVERY' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink sm:col-span-2">
              Street / area
              <input
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              City
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Landmark
              <input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}

        <div>
          <label className="text-sm font-medium text-ink">Add products</label>
          <div className="mt-1 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void searchProducts()
                }
              }}
              className="w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
              placeholder="Search catalog"
            />
            <button
              type="button"
              onClick={() => void searchProducts()}
              className="rounded-xl bg-cream px-4 text-sm font-semibold text-ink"
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>
          {results.length > 0 ? (
            <div className="mt-2 divide-y divide-wine/10 rounded-xl border border-wine/10">
              {results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-cream"
                >
                  <span>{product.name}</span>
                  <span className="font-semibold">{formatPriceNoDecimals(unitPrice(product))}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {lines.length > 0 ? (
          <div className="divide-y divide-wine/10 rounded-xl border border-wine/10">
            {lines.map((line) => (
              <div key={line.productId} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">{line.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) =>
                      prev
                        .map((item) =>
                          item.productId === line.productId
                            ? { ...item, quantity: item.quantity - 1 }
                            : item
                        )
                        .filter((item) => item.quantity > 0)
                    )
                  }
                  className="h-7 w-7 rounded-full bg-cream"
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold">{line.quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setLines((prev) =>
                      prev.map((item) =>
                        item.productId === line.productId
                          ? { ...item, quantity: item.quantity + 1 }
                          : item
                      )
                    )
                  }
                  className="h-7 w-7 rounded-full bg-cream"
                >
                  +
                </button>
                <span className="w-20 text-right font-semibold">
                  {formatPriceNoDecimals(line.price * line.quantity)}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-ink">
            Discount
            <input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Delivery fee
            <input
              disabled={fulfillmentType === 'PICKUP'}
              value={fulfillmentType === 'PICKUP' ? '0' : deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>
          <label className="text-sm font-medium text-ink">
            Payment
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'ONLINE' | 'CARD')}
              className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
            >
              <option value="CASH">Cash</option>
              <option value="ONLINE">Online / UPI</option>
              <option value="CARD">Card</option>
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          Payment already collected
        </label>

        <label className="text-sm font-medium text-ink">
          Note
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-wine/15 px-3 py-2 text-sm"
            placeholder="Optional — e.g. Instagram DM, promised time"
          />
        </label>

        <div className="flex items-center justify-between border-t border-wine/10 pt-4">
          <p className="text-lg font-bold text-wine">{formatPriceNoDecimals(total)}</p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-wine px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create offline order'}
          </button>
        </div>
      </form>
    </div>
  )
}
