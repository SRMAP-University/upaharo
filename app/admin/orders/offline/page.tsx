'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import AdminPageHeader, { adminButtonClass } from '@/components/admin/AdminPageHeader'
import { useRouter, useSearchParams } from 'next/navigation'
import { resolveImageUrl } from '@/lib/image-url'
import { formatPriceNoDecimals } from '@/lib/utils'

type CatalogProduct = {
  id: string
  name: string
  price: number
  discount?: number | null
  image?: string | null
  isAvailable?: boolean
  category?: string
}

type Line = {
  key: string
  /** Empty for a custom item that hasn't been saved yet. */
  productId?: string
  name: string
  /** Unit price as typed, so the box can be cleared while editing. */
  price: string
  /** The product's shop price, to show when the price was changed. */
  shopPrice?: number
  quantity: number
  custom: boolean
  inactive?: boolean
}

const CHANNELS = [
  { id: 'WALK_IN', label: 'Walk-in' },
  { id: 'PHONE', label: 'Phone' },
  { id: 'WHATSAPP', label: 'WhatsApp' },
  { id: 'INSTAGRAM', label: 'Instagram' },
  { id: 'OTHER', label: 'Other' },
] as const
type Channel = (typeof CHANNELS)[number]['id']

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink focus:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/10'

function shopPrice(product: CatalogProduct) {
  const discount = Number(product.discount) || 0
  return Math.round((discount > 0 ? product.price * (1 - discount / 100) : product.price) * 100) / 100
}

const priceOf = (line: Line) => Math.max(0, Number(line.price) || 0)
let keySeq = 0
const nextKey = () => `l${Date.now()}-${keySeq++}`

function OfflineOrderForm() {
  const router = useRouter()
  const editId = useSearchParams().get('edit')
  const [loadingOrder, setLoadingOrder] = useState(Boolean(editId))
  const [orderNumber, setOrderNumber] = useState('')
  const [channel, setChannel] = useState<Channel>('PHONE')
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
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Product search: live as you type; the newest products show before you type.
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [results, setResults] = useState<CatalogProduct[]>([])
  const [searching, setSearching] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Custom item being typed.
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const [customQty, setCustomQty] = useState('1')

  const subtotal = lines.reduce((sum, line) => sum + priceOf(line) * line.quantity, 0)
  const discountAmt = Math.min(Math.max(0, Number(discount) || 0), subtotal)
  const fee = fulfillmentType === 'PICKUP' ? 0 : Math.max(0, Number(deliveryFee) || 0)
  const total = Math.max(0, subtotal - discountAmt + fee)
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0)

  // Load the order when editing.
  useEffect(() => {
    if (!editId) return
    let cancelled = false
    fetch(`/api/admin/orders/${editId}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Could not load the order')
        return data
      })
      .then((order) => {
        if (cancelled) return
        setOrderNumber(order.orderNumber || '')
        setChannel((CHANNELS.some((c) => c.id === order.offlineChannel) ? order.offlineChannel : 'OTHER') as Channel)
        setFulfillmentType(order.fulfillmentType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP')
        setCustomerName(order.user?.name && order.user.name !== 'Walk-in customer' ? order.user.name : '')
        setCustomerPhone(order.user?.phone || '')
        setNote(order.offlineNote || '')
        setStreet(order.address?.street || '')
        setCity(order.address?.city || 'Kathmandu')
        setLandmark(order.address?.landmark || '')
        setDiscount(String(order.discount || 0))
        setDeliveryFee(String(order.deliveryFee || 0))
        setPaymentMethod(['ONLINE', 'CARD'].includes(order.paymentMethod) ? order.paymentMethod : 'CASH')
        setPaid(order.paymentStatus === 'COMPLETED')
        setLines(
          (order.items || []).map((item: any) => ({
            key: nextKey(),
            productId: item.productId,
            name: item.product?.name || 'Item',
            price: String(item.price),
            shopPrice: item.isCustom || !item.product ? undefined : shopPrice(item.product),
            quantity: item.quantity,
            custom: Boolean(item.isCustom),
          }))
        )
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load the order'))
      .finally(() => !cancelled && setLoadingOrder(false))
    return () => {
      cancelled = true
    }
  }, [editId])

  useEffect(() => {
    if (!pickerOpen) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ limit: '20', sort: 'newest', inventory: '1' })
        if (query.trim()) params.set('search', query.trim())
        const res = await fetch(`/api/admin/products?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (!cancelled) setResults(Array.isArray(data?.products) ? data.products : [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, query.trim() ? 250 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, pickerOpen])

  // Close the product list when clicking elsewhere.
  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  const addProduct = (product: CatalogProduct) => {
    // Close the list so it never sits over the items; focus the search again to add more.
    setPickerOpen(false)
    setQuery('')
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id)
      if (existing) {
        return prev.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line))
      }
      const price = shopPrice(product)
      return [
        ...prev,
        {
          key: nextKey(),
          productId: product.id,
          name: product.name,
          price: String(price),
          shopPrice: price,
          quantity: 1,
          custom: false,
          inactive: product.isAvailable === false,
        },
      ]
    })
  }

  const addCustom = () => {
    const name = customName.trim()
    const price = Number(customPrice)
    if (!name) return setError('Give the custom item a name')
    if (!Number.isFinite(price) || price < 0 || customPrice.trim() === '') return setError('Give the custom item a price')
    setError('')
    setLines((prev) => [
      ...prev,
      { key: nextKey(), name, price: String(price), quantity: Math.max(1, Math.round(Number(customQty) || 1)), custom: true },
    ])
    setCustomName('')
    setCustomPrice('')
    setCustomQty('1')
  }

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  const removeLine = (key: string) => setLines((prev) => prev.filter((line) => line.key !== key))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (lines.length === 0) {
      setError('Add at least one product')
      return
    }
    if (lines.some((line) => line.price.trim() === '' || !Number.isFinite(Number(line.price)) || Number(line.price) < 0)) {
      setError('Every item needs a price (0 or more)')
      return
    }
    if (lines.some((line) => !line.name.trim())) {
      setError('Every item needs a name')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(editId ? `/api/admin/orders/${editId}` : '/api/admin/orders', {
        method: editId ? 'PUT' : 'POST',
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
          items: lines.map((line) => ({
            productId: line.productId,
            name: line.name.trim(),
            price: priceOf(line),
            quantity: line.quantity,
          })),
          address: fulfillmentType === 'DELIVERY' ? { street, city, landmark } : null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || (editId ? 'Failed to save the order' : 'Failed to create order'))
        return
      }
      router.push('/admin/orders')
    } catch {
      setError(editId ? 'Failed to save the order' : 'Failed to create order')
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

  if (loadingOrder) {
    return <div className="p-8 text-center text-sm text-ink/55">Loading order…</div>
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title={editId ? `Edit offline order${orderNumber ? ` ${orderNumber}` : ''}` : 'New offline order'}
        description={editId ? 'Change items, prices, customer, delivery or payment, then save.' : channelHint}
        back={{ href: '/admin/orders', label: 'Orders' }}
      />

      <form onSubmit={submit} className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink">Customer</h3>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setChannel(item.id)
                  if (item.id === 'WALK_IN' && !editId) setFulfillmentType('PICKUP')
                }}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  channel === item.id ? 'bg-wine text-white' : 'bg-stone-100 text-ink/70 hover:bg-stone-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-ink">
              Customer name
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} placeholder="Optional for walk-in" />
            </label>
            <label className="text-sm font-medium text-ink">
              Phone
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} placeholder="98xxxxxxxx" />
            </label>
          </div>
          <div className="flex gap-2">
            {(['DELIVERY', 'PICKUP'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFulfillmentType(type)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  fulfillmentType === type ? 'bg-wine/10 text-wine ring-1 ring-wine/20' : 'bg-stone-100 text-ink/70'
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
                <input required value={street} onChange={(e) => setStreet(e.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-medium text-ink">
                City
                <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-medium text-ink">
                Landmark
                <input value={landmark} onChange={(e) => setLandmark(e.target.value)} className={inputClass} />
              </label>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Items</h3>
            <span className="text-xs text-ink/50">Any product, active or inactive. Prices can be changed.</span>
          </div>

          <div ref={pickerRef} className="relative">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPickerOpen(true)
              }}
              onFocus={() => setPickerOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (results[0]) addProduct(results[0])
                } else if (e.key === 'Escape') setPickerOpen(false)
              }}
              className={inputClass.replace('mt-1 ', '')}
              placeholder="Search products by name or SKU, or browse the newest"
              aria-label="Search products"
            />
            {pickerOpen ? (
              <div className="mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white">
                {searching && results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink/50">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink/50">
                    No products found. Add it below as a custom item.
                  </p>
                ) : (
                  results.map((product) => {
                    const inCart = lines.find((line) => line.productId === product.id)
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                      >
                        {product.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resolveImageUrl(product.image)} alt="" className="h-9 w-9 shrink-0 rounded-md bg-stone-100 object-cover" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 rounded-md bg-stone-100" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{product.name}</span>
                          <span className="block truncate text-xs text-ink/45">
                            {product.category}
                            {product.isAvailable === false ? ' · inactive' : ''}
                            {inCart ? ` · in order ×${inCart.quantity}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold text-ink">{formatPriceNoDecimals(shopPrice(product))}</span>
                        <span className="shrink-0 rounded-md bg-wine/10 px-2 py-1 text-xs font-semibold text-wine">+ Add</span>
                      </button>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>

          {lines.length > 0 ? (
            <div className="divide-y divide-stone-200 rounded-xl border border-stone-200">
              {lines.map((line) => {
                const changed = line.shopPrice !== undefined && Math.abs(priceOf(line) - line.shopPrice) > 0.004
                return (
                  <div key={line.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm">
                    <div className="min-w-[10rem] flex-1">
                      {line.custom ? (
                        <input
                          value={line.name}
                          onChange={(e) => updateLine(line.key, { name: e.target.value })}
                          className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
                          aria-label="Item name"
                        />
                      ) : (
                        <span className="font-medium text-ink">{line.name}</span>
                      )}
                      <span className="mt-0.5 block text-xs text-ink/45">
                        {line.custom ? 'Custom item' : changed ? `Shop price ${formatPriceNoDecimals(line.shopPrice!)}` : 'Shop price'}
                        {line.inactive ? ' · inactive product' : ''}
                      </span>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-ink/55">
                      Rs
                      <input
                        inputMode="decimal"
                        value={line.price}
                        onChange={(e) => updateLine(line.key, { price: e.target.value })}
                        className={`w-24 rounded-md border px-2 py-1 text-right text-sm text-ink ${changed ? 'border-amber-400 bg-amber-50' : 'border-stone-300'}`}
                        aria-label={`Price of ${line.name}`}
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                        className="h-7 w-7 rounded-md bg-stone-100 text-ink"
                        aria-label="One less"
                      >
                        −
                      </button>
                      <input
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                        className="w-12 rounded-md border border-stone-300 px-1 py-1 text-center text-sm"
                        aria-label={`Quantity of ${line.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateLine(line.key, { quantity: line.quantity + 1 })}
                        className="h-7 w-7 rounded-md bg-stone-100 text-ink"
                        aria-label="One more"
                      >
                        +
                      </button>
                    </div>
                    <span className="w-24 text-right font-semibold text-ink">
                      {formatPriceNoDecimals(priceOf(line) * line.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      aria-label={`Remove ${line.name}`}
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-300 px-3 py-4 text-center text-sm text-ink/50">
              No items yet. Search above, or add a custom item.
            </p>
          )}

          <div className="rounded-xl bg-stone-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Custom item</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_7rem_5rem_auto]">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Item name, e.g. Custom photo cake 2 lb"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                aria-label="Custom item name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustom()
                  }
                }}
              />
              <input
                inputMode="decimal"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Price"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                aria-label="Custom item price"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustom()
                  }
                }}
              />
              <input
                inputMode="numeric"
                value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                placeholder="Qty"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                aria-label="Custom item quantity"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustom()
                  }
                }}
              />
              <button type="button" onClick={addCustom} className={adminButtonClass.secondary}>
                + Add item
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-ink">Payment</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-ink">
              Discount (Rs)
              <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
            </label>
            <label className="text-sm font-medium text-ink">
              Delivery fee (Rs)
              <input
                inputMode="decimal"
                disabled={fulfillmentType === 'PICKUP'}
                value={fulfillmentType === 'PICKUP' ? '0' : deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className={`${inputClass} disabled:opacity-50`}
              />
            </label>
            <label className="text-sm font-medium text-ink">
              Payment
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'ONLINE' | 'CARD')}
                className={inputClass}
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
          <label className="block text-sm font-medium text-ink">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className={inputClass}
              placeholder="Optional, e.g. Instagram DM, promised time"
            />
          </label>

          <div className="space-y-1.5 border-t border-stone-200 pt-4 text-sm">
            <div className="flex justify-between text-ink/65">
              <span>
                Items ({itemCount})
              </span>
              <span>{formatPriceNoDecimals(subtotal)}</span>
            </div>
            {discountAmt > 0 ? (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>−{formatPriceNoDecimals(discountAmt)}</span>
              </div>
            ) : null}
            {fulfillmentType === 'DELIVERY' ? (
              <div className="flex justify-between text-ink/65">
                <span>Delivery fee</span>
                <span>{fee > 0 ? `+${formatPriceNoDecimals(fee)}` : 'Free'}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-2">
              <span className="text-base font-semibold text-ink">Total</span>
              <span className="text-xl font-bold text-wine">{formatPriceNoDecimals(total)}</span>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => router.push('/admin/orders')} className={adminButtonClass.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={adminButtonClass.primary}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Create offline order'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AdminOfflineOrderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-ink/55">Loading…</div>}>
      <OfflineOrderForm />
    </Suspense>
  )
}
