'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Header from '@/components/Header'
import BrandLogo from '@/components/BrandLogo'
import CakePreview from '@/components/cake/CakePreview'
import { AddonSwatch, ToppingSwatch } from '@/components/cake/CakeSwatches'
import {
  buildCakeVisual,
  cakeCartLineId,
  cakeLineName,
  emptyCakeSelection,
  isCakeCustomization,
  previewCakeTotal,
  priceCake,
  sanitizeCakeConfig,
  sanitizeCakeSelection,
  type CakeBuilderConfig,
  type CakeFieldError,
  type CakeSelection,
} from '@/lib/cake-builder'
import { resolveImageUrl } from '@/lib/image-url'
import { useCartStore } from '@/lib/store/cart'
import { uploadCakePhoto } from '@/lib/upload-image'
import { formatPriceCompact } from '@/lib/utils'

const SCRIPT_FONT = "'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive"
const fmt = (n: number) => formatPriceCompact(Math.round(n * 100) / 100)
const fmtLb = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(2).replace(/0$/, '')} lb`

// Soft pink and cream with the Upaharo red, as in the design reference.
const card =
  'relative flex items-center rounded-2xl border bg-white text-center shadow-[0_6px_18px_-14px_rgba(122,31,43,0.45)] transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'
const cardOn = 'border-brand bg-[#FFF3F4] ring-1 ring-brand'
const cardOff = 'border-[#F1DADD] hover:border-[#E9B9C0]'

function Radio({ on, square = false }: { on: boolean; square?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border-2 ${square ? 'rounded-md' : 'rounded-full'} ${
        on ? 'border-brand bg-brand' : 'border-[#D9BFC3] bg-white'
      }`}
    >
      {on ? (
        square ? (
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white" fill="currentColor">
            <path d="M7.6 13.4 4.2 10l-1.2 1.2 4.6 4.6 9.4-9.4L15.8 5z" />
          </svg>
        ) : (
          <span className="h-2 w-2 rounded-full bg-white" />
        )
      ) : null}
    </span>
  )
}

function Step({
  n,
  title,
  optional,
  hint,
  error,
  children,
  id,
}: {
  n: number
  title: string
  optional?: boolean
  hint?: string
  error?: string
  children: ReactNode
  id: string
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#4A1D1F] text-sm font-bold text-white">
          {n}
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#3B1416]">
            {title}
            {optional ? <span className="ml-1.5 text-sm font-medium text-[#3B1416]/55">(Optional)</span> : null}
          </h2>
          {hint ? <p className="text-[13px] text-[#3B1416]/65">{hint}</p> : null}
        </div>
      </div>
      <div className="mt-3">{children}</div>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">
          {error}
        </p>
      ) : null}
    </section>
  )
}

function OptionImage({ src, alt, children }: { src: string; alt: string; children: ReactNode }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={resolveImageUrl(src)} alt={alt} className="h-full w-full object-contain" loading="lazy" />
  }
  return <>{children}</>
}

type LoadState = { status: 'loading' } | { status: 'off' } | { status: 'error' } | { status: 'ready'; config: CakeBuilderConfig }

export default function CakeBuilder() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('edit')
  const cartItems = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const replaceItem = useCartStore((s) => s.replaceItem)
  const cartCount = useCartStore((s) => s.getTotalItems())

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selection, setSelection] = useState<CakeSelection>(emptyCakeSelection())
  const [quantity, setQuantity] = useState(1)
  const [errors, setErrors] = useState<CakeFieldError[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [mounted, setMounted] = useState(false)
  const flavourRow = useRef<HTMLDivElement | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/cake-builder', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (cancelled) return
        if (!data?.enabled) {
          setState({ status: 'off' })
          return
        }
        const config = sanitizeCakeConfig(data.config)
        setState({ status: 'ready', config })
        setSelection((current) => (current.sizeId ? current : emptyCakeSelection(config)))
      })
      .catch(() => !cancelled && setState({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [])

  // Editing a cake already in the cart: start from its picks.
  const editing = useMemo(() => {
    if (!editId || !mounted) return null
    const item = cartItems.find((i) => i.id === editId)
    return item && isCakeCustomization(item.customization) ? item : null
  }, [editId, mounted, cartItems])

  const loadedEdit = useRef(false)
  useEffect(() => {
    if (!editing || loadedEdit.current || state.status !== 'ready') return
    loadedEdit.current = true
    setSelection(sanitizeCakeSelection(editing.customization!.selection))
    setQuantity(editing.quantity)
  }, [editing, state.status])

  const config = state.status === 'ready' ? state.config : null
  const size = config?.sizes.find((s) => s.id === selection.sizeId)
  const maxFlavours = size?.maxFlavours ?? 1
  const visual = useMemo(() => (config ? buildCakeVisual(config, selection) : null), [config, selection])
  const unitTotal = config ? previewCakeTotal(config, selection) : 0
  const pounds = visual?.pounds ?? 1

  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message
  const clearError = (field: string) => setErrors((list) => list.filter((e) => e.field !== field))

  const update = (patch: Partial<CakeSelection>, field?: string) => {
    setSelection((s) => ({ ...s, ...patch }))
    if (field) clearError(field)
  }

  const chooseSize = (id: string) => {
    if (!config) return
    const next = config.sizes.find((s) => s.id === id)
    setSelection((s) => ({
      ...s,
      sizeId: id,
      customPounds: next?.custom ? s.customPounds ?? next.minPounds : s.customPounds,
      flavourIds: s.flavourIds.slice(0, next?.maxFlavours ?? 1),
    }))
    clearError('size')
  }

  const toggleFlavour = (id: string) => {
    setSelection((s) => {
      if (s.flavourIds.includes(id)) return { ...s, flavourIds: s.flavourIds.filter((f) => f !== id) }
      if (maxFlavours <= 1) return { ...s, flavourIds: [id] }
      if (s.flavourIds.length >= maxFlavours) return { ...s, flavourIds: [...s.flavourIds.slice(1), id] }
      return { ...s, flavourIds: [...s.flavourIds, id] }
    })
    clearError('flavour')
  }

  const toggleIn = (key: 'toppingIds' | 'addonIds', id: string) => {
    setSelection((s) => {
      const has = s[key].includes(id)
      if (!has && key === 'toppingIds' && config && config.maxToppings > 0 && s.toppingIds.length >= config.maxToppings) {
        return s
      }
      return { ...s, [key]: has ? s[key].filter((x) => x !== id) : [...s[key], id] }
    })
    clearError(key === 'toppingIds' ? 'toppings' : 'addons')
    clearError(`addon:${id}`)
  }

  const onUpload = async (addonId: string, file: File | null) => {
    if (!file) return
    setUploading(addonId)
    setUploadError((e) => ({ ...e, [addonId]: '' }))
    try {
      const url = await uploadCakePhoto(file)
      setSelection((s) => ({ ...s, addonImages: { ...s.addonImages, [addonId]: url } }))
      clearError(`addon:${addonId}`)
    } catch (error) {
      setUploadError((e) => ({ ...e, [addonId]: error instanceof Error ? error.message : 'Upload failed' }))
    } finally {
      setUploading(null)
    }
  }

  const scrollToError = (list: CakeFieldError[]) => {
    const first = list[0]?.field || ''
    const target = first.startsWith('addon') ? 'step-addons' : `step-${first === 'toppings' ? 'toppings' : first}`
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleAdd = () => {
    if (!config) return
    const result = priceCake(config, selection)
    if (!result.ok) {
      setErrors(result.errors)
      scrollToError(result.errors)
      return
    }
    setAdding(true)
    const { customization, unitPrice } = result
    const line = {
      id: cakeCartLineId(config.productId, customization.selection),
      name: cakeLineName(customization.summary),
      price: unitPrice,
      image: config.heroImage ? resolveImageUrl(config.heroImage) : '',
      isVeg: customization.summary.isVeg,
      customization,
    }
    const href = (id: string) => `/build-your-cake?edit=${encodeURIComponent(id)}`
    if (editing) {
      replaceItem(editing.id, { ...line, href: href(line.id), quantity })
    } else {
      addItem({ ...line, href: href(line.id), quantity })
    }
    router.push('/cart')
  }

  const messageLength = [...selection.message].length

  // ---------------------------------------------------------------- states

  if (state.status !== 'ready' || !config || !visual) {
    return (
      <div className="min-h-screen bg-[#FFF8F8]">
        <div className="hidden lg:block">
          <Header />
        </div>
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          {state.status === 'loading' ? (
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" aria-label="Loading" />
          ) : (
            <>
              <h1 className="text-2xl font-bold text-[#3B1416]">
                {state.status === 'off' ? 'Custom cakes are coming soon' : 'We couldn’t load the cake builder'}
              </h1>
              <p className="mt-2 text-sm text-[#3B1416]/65">
                {state.status === 'off'
                  ? 'Meanwhile, browse our ready-made cakes and gifts.'
                  : 'Please check your connection and try again.'}
              </p>
              <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-brand px-8 font-semibold text-white">
                Browse gifts
              </Link>
            </>
          )}
        </div>
      </div>
    )
  }

  const summaryRows: Array<[string, string]> = [
    ['Size', size ? (size.custom ? `${size.label} (${fmtLb(pounds)})` : size.label) : '—'],
    [
      'Flavour',
      selection.flavourIds.map((id) => config.flavours.find((f) => f.id === id)?.name).filter(Boolean).join(' & ') || '—',
    ],
    ['Type', config.types.find((t) => t.id === selection.typeId)?.label || '—'],
    [
      'Toppings',
      selection.toppingIds.map((id) => config.toppings.find((t) => t.id === id)?.name).filter(Boolean).join(', ') || 'None',
    ],
    [
      'Add-ons',
      selection.addonIds.map((id) => config.addons.find((a) => a.id === id)?.name).filter(Boolean).join(', ') || 'None',
    ],
    ['Message', selection.message.trim() || '—'],
  ]

  const addLabel = editing ? 'Update cart' : 'Add to Cart'
  const placeholder = !selection.sizeId && selection.flavourIds.length === 0

  const previewCard = (
    <div className="overflow-hidden rounded-3xl border border-[#F1DADD] bg-gradient-to-b from-[#FFF0F2] to-white p-4">
      <h2 className="text-base font-bold text-[#3B1416]">Your Cake Preview</h2>
      <CakePreview visual={visual} placeholder={placeholder} showSizeLabel={!placeholder} className="mx-auto mt-1 w-full max-w-[420px]" />
      <p className="text-center text-[11px] italic text-[#3B1416]/50">
        {placeholder ? 'Pick a size and flavour to see your cake' : '* Actual design may vary slightly'}
      </p>
    </div>
  )

  const summaryCard = (
    <div className="rounded-3xl border border-[#F1DADD] bg-white p-4 lg:p-5">
      <h2 className="text-base font-bold text-[#3B1416]">Order Summary</h2>
      <dl className="mt-3 divide-y divide-[#F6E6E8] text-sm">
        {summaryRows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 py-2">
            <dt className="flex-shrink-0 text-[#3B1416]/60">{label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-[#3B1416]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#FFF1F3] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#3B1416]">Total Price</p>
          {quantity > 1 ? <p className="text-xs text-[#3B1416]/55">{fmt(unitTotal)} × {quantity}</p> : null}
        </div>
        <p className="text-2xl font-extrabold text-brand" aria-live="polite">
          {fmt(unitTotal * quantity)}
        </p>
      </div>
      {config.note ? <p className="mt-2 text-xs text-[#3B1416]/55">{config.note}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex items-center rounded-full border border-[#F1DADD] bg-white p-1">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-[#3B1416] hover:bg-[#FFF1F3]"
            aria-label="One fewer cake"
          >
            −
          </button>
          <span className="w-7 text-center text-sm font-bold text-[#3B1416]" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold text-[#3B1416] hover:bg-[#FFF1F3]"
            aria-label="One more cake"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="hidden h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(232,50,43,0.8)] transition hover:bg-brand-dark disabled:opacity-60 lg:flex"
        >
          <CartIcon /> {addLabel}
        </button>
      </div>
      {errors.length > 0 ? (
        <p className="mt-3 text-sm font-medium text-brand-dark">Please finish: {errors.map((e) => e.message).join(' ')}</p>
      ) : null}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FFF8F8] pb-28 lg:pb-16">
      <div className="hidden lg:block">
        <Header />
      </div>

      {/* Phone top bar */}
      <div className="sticky top-0 z-40 border-b border-[#F1DADD] bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#3B1416] hover:bg-[#FFF1F3]"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2" aria-label="Upaharo home">
            <BrandLogo size={30} />
            <span className="text-lg font-extrabold tracking-tight text-[#3B1416]">upaharo</span>
          </Link>
          <Link href="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#3B1416] hover:bg-[#FFF1F3]" aria-label={`Cart, ${mounted ? cartCount : 0} items`}>
            <CartIcon className="h-6 w-6" />
            {mounted && cartCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 pt-3 lg:px-8 lg:pt-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#FFE4E8] via-[#FFF0F2] to-[#FFE4E8]">
          <div className="grid grid-cols-[1.1fr_1fr] items-center gap-2 px-4 py-4 lg:grid-cols-[1fr_auto_1fr] lg:px-10 lg:py-6">
            <div>
              <p className="text-lg font-bold leading-tight text-[#4A1D1F] lg:text-3xl">
                {config.title.replace(/\s*cake\s*$/i, '') || 'Build Your Own'}
              </p>
              <p className="text-5xl font-black italic leading-none text-[#4A1D1F] lg:text-7xl" style={{ fontFamily: SCRIPT_FONT }}>Cake</p>
              <p className="mt-2 text-xs font-medium text-[#4A1D1F]/80 lg:text-base">{config.subtitle}</p>
            </div>
            <div className="h-28 lg:h-44">
              {config.heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resolveImageUrl(config.heroImage)} alt="" className="h-full w-full object-contain" />
              ) : (
                <CakePreview
                  className="h-full w-full"
                  visual={{
                    pounds: 1.5,
                    diameterInch: 7,
                    flavours: [{ frosting: '#F7E3CF', sponge: '#3E2117', drip: '#3A1D12' }],
                    toppings: ['fruits', 'whipped'],
                    addons: [],
                    message: '',
                    photoUrl: '',
                  }}
                />
              )}
            </div>
            <p className="hidden -rotate-6 text-right text-3xl italic text-[#4A1D1F] lg:block" style={{ fontFamily: SCRIPT_FONT }}>
              Your Dream Cake,
              <br />
              Your Way!
            </p>
          </div>
        </div>

        <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8">
          <div className="space-y-7 rounded-3xl border border-[#F1DADD] bg-white/70 p-3 lg:p-6">
            {/* 1. Size */}
            <Step n={1} id="step-size" title="Choose Size" hint="Select the perfect size for your celebration" error={errorFor('size')}>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Cake size">
                {config.sizes.map((s) => {
                  const on = selection.sizeId === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseSize(s.id)}
                      className={`${card} ${on ? cardOn : cardOff} flex-col px-2 pb-3 pt-2`}
                    >
                      <span className="h-20 w-full">
                        <OptionImage src={s.image} alt={s.label}>
                          <CakePreview
                            className="h-full w-full"
                            visual={{
                              pounds: s.custom ? 3 : s.pounds,
                              diameterInch: s.diameterInch,
                              flavours: [{ frosting: '#FFF6EC', sponge: '#EBC99A', drip: s.pounds >= 1 || s.custom ? '#4A2617' : '' }],
                              toppings: ['fruits'],
                              addons: [],
                              message: '',
                              photoUrl: '',
                            }}
                          />
                        </OptionImage>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <Radio on={on} />
                        <span className="text-[15px] font-bold text-[#3B1416]">{s.label}</span>
                      </span>
                      {s.serves ? <span className="text-xs text-[#3B1416]/60">({s.serves})</span> : null}
                      <span className="mt-1 text-sm font-bold text-brand">
                        {s.custom ? `${fmt(s.pricePerPound)}/lb` : fmt(s.price)}
                      </span>
                    </button>
                  )
                })}
              </div>
              {size?.custom ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#F1DADD] bg-[#FFF8F9] px-4 py-3">
                  <span className="text-sm font-semibold text-[#3B1416]">Weight</span>
                  <div className="flex items-center rounded-full border border-[#F1DADD] bg-white p-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
                      aria-label="Less weight"
                      onClick={() =>
                        update({ customPounds: Math.max(size.minPounds, (selection.customPounds ?? size.minPounds) - size.stepPounds) }, 'size')
                      }
                    >
                      −
                    </button>
                    <span className="w-16 text-center text-sm font-bold" aria-live="polite">
                      {fmtLb(pounds)}
                    </span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold"
                      aria-label="More weight"
                      onClick={() =>
                        update({ customPounds: Math.min(size.maxPounds, (selection.customPounds ?? size.minPounds) + size.stepPounds) }, 'size')
                      }
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-[#3B1416]/60">
                    {fmtLb(size.minPounds)} to {fmtLb(size.maxPounds)} · {fmt(size.pricePerPound * pounds)}
                  </span>
                </div>
              ) : null}
            </Step>

            {/* 2. Flavour */}
            <Step
              n={2}
              id="step-flavour"
              title="Choose Flavour"
              hint={maxFlavours > 1 ? `Pick up to ${maxFlavours} flavours for this size` : 'Pick your favourite flavour'}
              error={errorFor('flavour')}
            >
              <div className="relative">
                <div
                  ref={flavourRow}
                  className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-5"
                  role={maxFlavours > 1 ? 'group' : 'radiogroup'}
                  aria-label="Cake flavour"
                >
                  {config.flavours.map((f) => {
                    const on = selection.flavourIds.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        role={maxFlavours > 1 ? 'checkbox' : 'radio'}
                        aria-checked={on}
                        onClick={() => toggleFlavour(f.id)}
                        className={`${card} ${on ? cardOn : cardOff} w-[112px] flex-shrink-0 snap-start flex-col px-2 pb-2.5 pt-2 sm:w-auto`}
                      >
                        <span className="h-16 w-full">
                          <OptionImage src={f.image} alt={f.name}>
                            <CakePreview
                              className="h-full w-full"
                              visual={{ pounds: 1, diameterInch: 6, flavours: [f], toppings: [], addons: [], message: '', photoUrl: '' }}
                            />
                          </OptionImage>
                        </span>
                        <span className="mt-1 min-h-[2.5rem] text-[13px] font-semibold leading-tight text-[#3B1416]">{f.name}</span>
                        {f.surchargePerPound > 0 ? (
                          <span className="text-[11px] font-semibold text-brand">+{fmt(f.surchargePerPound)}/lb</span>
                        ) : (
                          <span className="text-[11px] text-transparent">.</span>
                        )}
                        <span className="mt-1">
                          <Radio on={on} square={maxFlavours > 1} />
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => flavourRow.current?.scrollBy({ left: 240, behavior: 'smooth' })}
                  className="absolute -right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#F1DADD] bg-white shadow sm:hidden"
                  aria-label="More flavours"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </Step>

            {/* 3. Type */}
            <Step n={3} id="step-type" title="Cake Type" hint="Choose your cake style" error={errorFor('type')}>
              <div className="grid grid-cols-2 gap-2.5 sm:max-w-md" role="radiogroup" aria-label="Cake type">
                {config.types.map((t) => {
                  const on = selection.typeId === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => update({ typeId: t.id }, 'type')}
                      className={`${card} ${on ? cardOn : cardOff} flex-row justify-between gap-2 px-3.5 py-3 text-left`}
                    >
                      <span className="flex items-center gap-2.5">
                        <TypeIcon isVeg={t.isVeg} />
                        <span>
                          <span className="block text-[15px] font-bold text-[#3B1416]">{t.label}</span>
                          {t.note ? <span className="block text-[11px] text-[#3B1416]/60">{t.note}</span> : null}
                          {t.surchargePerPound > 0 ? (
                            <span className="block text-[11px] font-semibold text-brand">+{fmt(t.surchargePerPound)}/lb</span>
                          ) : null}
                        </span>
                      </span>
                      <Radio on={on} />
                    </button>
                  )
                })}
              </div>
            </Step>

            {/* 4. Toppings */}
            {config.toppings.length > 0 ? (
              <Step
                n={4}
                id="step-toppings"
                title="Add Toppings"
                optional
                hint={config.maxToppings > 0 ? `Make it extra special · up to ${config.maxToppings}` : 'Make it extra special · pick as many as you like'}
                error={errorFor('toppings')}
              >
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5" role="group" aria-label="Toppings">
                  {config.toppings.map((t) => {
                    const on = selection.toppingIds.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggleIn('toppingIds', t.id)}
                        className={`${card} ${on ? cardOn : cardOff} flex-col px-1.5 pb-2.5 pt-2`}
                      >
                        <span className="h-14 w-full">
                          <OptionImage src={t.image} alt={t.name}>
                            <ToppingSwatch kind={t.visual} className="h-full w-full" />
                          </OptionImage>
                        </span>
                        <span className="mt-1 text-[13px] font-semibold leading-tight text-[#3B1416]">{t.name}</span>
                        <span className="text-[11px] text-[#3B1416]/60">{t.price > 0 ? `+${fmt(t.price)}` : 'Free'}</span>
                        <span className="mt-1">
                          <Radio on={on} square />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </Step>
            ) : null}

            {/* 5. Add-ons */}
            {config.addons.length > 0 ? (
              <Step n={config.toppings.length > 0 ? 5 : 4} id="step-addons" title="Extras & Decorations" optional hint="Toppers, candles, photo cakes and more" error={errorFor('addons')}>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6" role="group" aria-label="Add-ons">
                  {config.addons.map((a) => {
                    const on = selection.addonIds.includes(a.id)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggleIn('addonIds', a.id)}
                        className={`${card} ${on ? cardOn : cardOff} flex-col px-1.5 pb-2.5 pt-2`}
                      >
                        <span className="h-14 w-full">
                          <OptionImage src={a.image} alt={a.name}>
                            <AddonSwatch kind={a.visual} className="h-full w-full" />
                          </OptionImage>
                        </span>
                        <span className="mt-1 text-[13px] font-semibold leading-tight text-[#3B1416]">{a.name}</span>
                        <span className="text-[11px] text-[#3B1416]/60">{a.price > 0 ? `+${fmt(a.price)}` : 'Free'}</span>
                        <span className="mt-1">
                          <Radio on={on} square />
                        </span>
                      </button>
                    )
                  })}
                </div>

                {config.addons
                  .filter((a) => selection.addonIds.includes(a.id) && (a.needsImage || a.needsNote))
                  .map((a) => (
                    <div key={a.id} className="mt-3 rounded-2xl border border-[#F1DADD] bg-[#FFF8F9] p-3">
                      <p className="text-sm font-bold text-[#3B1416]">{a.name}</p>
                      {a.description ? <p className="text-xs text-[#3B1416]/60">{a.description}</p> : null}
                      {a.needsImage ? (
                        <div className="mt-2 flex items-center gap-3">
                          {selection.addonImages[a.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveImageUrl(selection.addonImages[a.id])}
                              alt="Your upload"
                              className="h-16 w-16 rounded-xl border border-[#F1DADD] object-cover"
                            />
                          ) : null}
                          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-brand bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-soft">
                            {uploading === a.id ? 'Uploading…' : selection.addonImages[a.id] ? 'Change picture' : 'Upload picture'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="sr-only"
                              disabled={uploading !== null}
                              onChange={(e) => {
                                void onUpload(a.id, e.target.files?.[0] || null)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        </div>
                      ) : null}
                      {uploadError[a.id] ? (
                        <p className="mt-2 text-sm text-brand-dark">
                          {uploadError[a.id]}{' '}
                          {/sign in/i.test(uploadError[a.id]) ? (
                            <Link href={`/login?callbackUrl=${encodeURIComponent('/build-your-cake')}`} className="font-semibold underline">
                              Sign in
                            </Link>
                          ) : null}
                        </p>
                      ) : null}
                      {a.needsNote ? (
                        <textarea
                          value={selection.addonNotes[a.id] || ''}
                          onChange={(e) =>
                            update({ addonNotes: { ...selection.addonNotes, [a.id]: e.target.value.slice(0, 300) } }, `addon:${a.id}`)
                          }
                          rows={2}
                          placeholder="e.g. Unicorn theme in pastel pink and gold"
                          className="mt-2 w-full rounded-xl border border-[#F1DADD] bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                        />
                      ) : null}
                      {errorFor(`addon:${a.id}`) ? (
                        <p role="alert" className="mt-1 text-sm font-medium text-brand-dark">
                          {errorFor(`addon:${a.id}`)}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </Step>
            ) : null}

            {/* 6. Message */}
            {config.message.enabled ? (
              <Step
                n={4 + (config.toppings.length > 0 ? 1 : 0) + (config.addons.length > 0 ? 1 : 0)}
                id="step-message"
                title="Add a Message"
                optional
                hint={config.message.price > 0 ? `Piped on your cake · +${fmt(config.message.price)}` : 'Write a sweet message on the cake'}
                error={errorFor('message')}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-[#F1DADD] bg-white px-3 focus-within:border-brand">
                  <input
                    value={selection.message}
                    onChange={(e) => {
                      const chars = [...e.target.value]
                      update({ message: chars.slice(0, config.message.maxLength).join('') }, 'message')
                    }}
                    placeholder="e.g. Happy Birthday!"
                    aria-label="Message on the cake"
                    className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                  />
                  <span className="text-xs tabular-nums text-[#3B1416]/50">
                    {messageLength}/{config.message.maxLength}
                  </span>
                </div>
              </Step>
            ) : null}

            {/* Preview and summary below the steps on phones */}
            <div className="grid gap-3 lg:hidden">
              {previewCard}
              {summaryCard}
            </div>
          </div>

          <aside className="hidden space-y-4 lg:sticky lg:top-24 lg:block">
            {previewCard}
            {summaryCard}
          </aside>
        </div>
      </div>

      {/* Phones: one bar with the total and the button */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#F1DADD] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-4">
          <div className="min-w-0">
            <p className="text-xs text-[#3B1416]/60">Total{quantity > 1 ? ` · ${quantity} cakes` : ''}</p>
            <p className="text-xl font-extrabold leading-tight text-brand">{fmt(unitTotal * quantity)}</p>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-base font-bold text-white shadow-[0_10px_24px_-12px_rgba(232,50,43,0.8)] transition active:scale-[0.99] disabled:opacity-60"
          >
            <CartIcon /> {addLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function CartIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M3 4h2l2.4 11.2a1.5 1.5 0 001.5 1.2h8.6a1.5 1.5 0 001.5-1.2L21 8H6.2" />
      <circle cx="9.5" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  )
}

function TypeIcon({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 ${isVeg ? 'border-emerald-600' : 'border-red-700'}`}
    >
      {isVeg ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> : <span className="h-0 w-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-red-700" />}
    </span>
  )
}
