'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import B2BHeader from '@/components/b2b/B2BHeader'
import SkeletonLoader from '@/components/SkeletonLoader'
import { useB2BCartStore } from '@/lib/store/b2b-cart'
import { formatPrice } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/image-url'

interface B2BProduct {
  id: string
  name: string
  miniDescription?: string | null
  description: string
  price: number
  wholesalePrice: number
  image: string
  category: string
  discount?: number | null
}

export default function B2BPage() {
  const [products, setProducts] = useState<B2BProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [supportPhone, setSupportPhone] = useState<string | null>(null)
  const [supportEmail, setSupportEmail] = useState<string | null>(null)
  const addItem = useB2BCartStore((s) => s.addItem)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    try {
      const [productsRes, settingsRes] = await Promise.all([
        fetch('/api/products?view=card&wholesale=1&limit=60'),
        fetch('/api/settings'),
      ])

      if (productsRes.ok) {
        const data = await productsRes.json()
        setProducts(
          (data.products || []).filter(
            (p: B2BProduct) => p.wholesalePrice != null && Number(p.wholesalePrice) >= 0
          )
        )
      }

      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        setSupportPhone(settings.supportPhone || null)
        setSupportEmail(settings.supportEmail || null)
      }
    } catch (error) {
      console.error('B2B load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return ['all', ...Array.from(set).sort()]
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        String(p.miniDescription || p.description || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [products, search, category])

  const enquireHref = supportPhone
    ? `https://wa.me/${supportPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
        'Hi, I am interested in wholesale pricing from Upaharo Business.'
      )}`
    : supportEmail
      ? `mailto:${supportEmail}?subject=${encodeURIComponent('Wholesale enquiry — Upaharo Business')}`
      : 'mailto:hello@upaharo.com?subject=Wholesale%20enquiry'

  return (
    <>
      <B2BHeader enquireHref={enquireHref} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-wine/10 bg-gradient-to-br from-[#FFE4EC] via-[#FFF0F4] to-[#F7F2EE] px-5 py-10 md:px-10 md:py-14">
          <div className="relative z-10 max-w-xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-wine/70">
              Wholesale · B2B only
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-wine md:text-5xl">
              Upaharo Business
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink/65 md:text-base">
              Wholesale cakes, flowers & gifts for cafés, hotels, event planners, and local shops.
              Add to your B2B cart and checkout here — completely separate from the retail shop.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/b2b/register"
                className="inline-flex items-center rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_34px_-22px_rgba(124,42,71,0.95)] hover:bg-wine-deep transition-colors"
              >
                Register your shop
              </Link>
              <a
                href="#catalog"
                className="inline-flex items-center rounded-full border border-wine/20 bg-white/80 px-5 py-2.5 text-sm font-semibold text-wine hover:border-wine/40 transition-colors"
              >
                Browse catalog
              </a>
              <Link
                href="/b2b/login"
                className="inline-flex items-center rounded-full border border-wine/20 bg-white/80 px-5 py-2.5 text-sm font-semibold text-wine hover:border-wine/40 transition-colors"
              >
                Business login
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-wine/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-gold/25 blur-2xl" />
        </section>

        <section id="catalog" className="scroll-mt-24">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Wholesale catalog</h2>
              <p className="mt-0.5 text-sm text-ink/45">
                {loading ? 'Loading…' : `${filtered.length} product${filtered.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:w-auto w-full">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-wine sm:w-64"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-wine/15 bg-white px-4 py-2.5 text-sm outline-none focus:border-wine sm:w-48"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All categories' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <SkeletonLoader variant="grid" count={8} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-wine/10 bg-white px-6 py-16 text-center">
              <p className="mb-3 text-4xl">📦</p>
              <h3 className="font-display text-xl font-semibold text-ink">No wholesale products yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink/50">
                Contact sales and we&apos;ll share current pricing for your business.
              </p>
              <a
                href={enquireHref}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-full bg-wine px-5 py-2.5 text-sm font-semibold text-white hover:bg-wine-deep"
              >
                Contact sales
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((product) => {
                const retail =
                  product.discount && product.discount > 0
                    ? product.price - (product.price * product.discount) / 100
                    : product.price
                const savePct =
                  retail > 0
                    ? Math.round(((retail - product.wholesalePrice) / retail) * 100)
                    : 0

                return (
                  <article
                    key={product.id}
                    className="overflow-hidden rounded-[22px] border border-wine/10 bg-white transition-all hover:border-wine/25 hover:shadow-[0_26px_55px_-38px_rgba(124,42,71,0.85)]"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-[#EDE6E0]">
                      <Image
                        src={resolveImageUrl(product.image)}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                      <span className="absolute left-2.5 top-2.5 rounded-full bg-wine px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Wholesale
                      </span>
                      {savePct > 0 && (
                        <span className="absolute right-2.5 top-2.5 rounded-full border border-wine/10 bg-white/95 px-2 py-0.5 text-[10px] font-bold text-wine">
                          vs retail −{savePct}%
                        </span>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                        {product.category}
                      </p>
                      <h3 className="font-display line-clamp-1 text-[15px] font-semibold text-ink">
                        {product.name}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink/40">
                        {product.miniDescription || product.description}
                      </p>
                      <div className="mt-2.5 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-semibold text-wine">
                            {formatPrice(product.wholesalePrice)}
                          </p>
                          <p className="text-[11px] text-ink/35">per unit · MOQ may apply</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            addItem({
                              id: product.id,
                              name: product.name,
                              price: product.wholesalePrice,
                              image: product.image,
                            })
                            setAddedId(product.id)
                            window.setTimeout(() => setAddedId((id) => (id === product.id ? null : id)), 1200)
                          }}
                          className="shrink-0 rounded-full bg-wine px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white hover:bg-wine-deep"
                        >
                          {addedId === product.id ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="mt-14 border-t border-wine/10 pt-8 text-center">
          <p className="font-display text-lg font-semibold text-wine">Upaharo Business</p>
          <p className="mt-1 text-sm text-ink/50">
            Independent wholesale portal · Own cart & orders · Not linked to retail
          </p>
          <a
            href={enquireHref}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm font-semibold text-wine hover:underline"
          >
            Contact sales
          </a>
          <p className="mt-6 text-[11px] text-ink/35">
            Wholesale unit rates for registered local businesses. Confirm pricing & minimum order
            quantities with our sales team before placing an order.
          </p>
        </footer>
      </main>
    </>
  )
}
