'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { APP_PROMPT_EVENT } from '@/components/AppDownloadReminder'
import { isInApp } from '@/lib/app-bridge'
import { resolveImageUrl } from '@/lib/image-url'
import { clearShopperMemory, getShopperSignals, MEMORY_EVENT } from '@/lib/shopper-memory'
import { useCartStore } from '@/lib/store/cart'
import { formatPriceNoDecimals } from '@/lib/utils'

/**
 * Upaharo helper: a shopping assistant on every shop page. It learns from the
 * shopper's recent clicks, searches, categories and cart (on this device, and
 * saved views when signed in), shows picks for them, and answers requests like
 * "cake for mom under 1500" with real products through the AI chat.
 */

type Product = {
  id: string
  name: string
  price: number
  image: string
  category?: string | null
  discount?: number | null
}
type Section = { key: string; title: string; note?: string; products: Product[] }
type Profile = {
  categories: string[]
  priceBand: { min: number; max: number; typical: number } | null
  searches: string[]
  strength: number
}
type Message = { role: 'user' | 'assistant'; content: string; products?: Product[] }

// Pages where the helper stays out of the way.
const HIDDEN_ON = /^\/(admin|seller|bill|checkout|app-features|login|auth|account-deletion|b2b|bhai-tika)(\/|$)/
// Pages with their own bottom buttons: no launcher on phones there.
const DESKTOP_ONLY_ON = /^\/(products|cart)(\/|$)/

const STARTERS = ['Something for me', 'Birthday cake under Rs 1,500', 'Flowers for my mom', 'Anniversary surprise']

const finalPrice = (p: Product) => (p.discount && p.discount > 0 ? p.price * (1 - p.discount / 100) : p.price)

function Sparkle({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5c.4 3.9 2.1 6.6 6.6 7.4.4.1.4.6 0 .7-4.5.8-6.2 3.5-6.6 7.4 0 .5-.7.5-.8 0-.4-3.9-2.1-6.6-6.6-7.4-.4-.1-.4-.6 0-.7 4.5-.8 6.2-3.5 6.6-7.4.1-.5.8-.5.8 0Z" />
      <path d="M19 15.5c.2 1.6.9 2.7 2.6 3 .2 0 .2.3 0 .3-1.7.3-2.4 1.4-2.6 3 0 .2-.3.2-.3 0-.2-1.6-.9-2.7-2.6-3-.2 0-.2-.3 0-.3 1.7-.3 2.4-1.4 2.6-3 0-.2.3-.2.3 0Z" />
    </svg>
  )
}

function MiniCard({ product, onOpen }: { product: Product; onOpen: () => void }) {
  const addItem = useCartStore((s) => s.addItem)
  const inCart = useCartStore((s) => s.items.some((i) => i.id === product.id))
  const price = finalPrice(product)
  return (
    <div className="w-[136px] flex-shrink-0">
      <div className="relative">
        <Link href={`/products/${product.id}`} onClick={onOpen} className="relative block aspect-square overflow-hidden rounded-2xl bg-mist">
          <Image src={resolveImageUrl(product.image)} alt={product.name} fill sizes="136px" quality={65} className="object-cover" />
          {product.discount && product.discount > 0 ? (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
              −{Math.round(product.discount)}%
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          aria-label={inCart ? `${product.name} is in your cart` : `Add ${product.name} to cart`}
          onClick={() =>
            addItem({ id: product.id, name: product.name, price, image: resolveImageUrl(product.image), isVeg: true })
          }
          className={`absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full shadow-[0_4px_12px_-4px_rgba(0,0,0,0.3)] transition active:scale-90 ${
            inCart ? 'bg-ink text-white' : 'bg-white text-ink'
          }`}
        >
          {inCart ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      </div>
      <Link href={`/products/${product.id}`} onClick={onOpen} className="block pt-1.5">
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-ink">{product.name}</p>
        <p className="mt-0.5 text-[13px] font-extrabold text-ink">{formatPriceNoDecimals(price)}</p>
      </Link>
    </div>
  )
}

function Rail({ products, onOpen }: { products: Product[]; onOpen: () => void }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
      {products.map((p) => (
        <MiniCard key={p.id} product={p} onOpen={onOpen} />
      ))}
    </div>
  )
}

export default function ShopAssistant() {
  const pathname = usePathname() || '/'
  const [mounted, setMounted] = useState(false)
  const [inApp, setInApp] = useState(false)
  const [open, setOpen] = useState(false)
  const [sections, setSections] = useState<Section[] | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const cartCount = useCartStore((s) => s.items.length)
  // The "Download the app" pop-up sits in the same corner: step aside while it shows.
  const [appPrompt, setAppPrompt] = useState(false)
  useEffect(() => {
    const onPrompt = (e: Event) => setAppPrompt(Boolean((e as CustomEvent<boolean>).detail))
    window.addEventListener(APP_PROMPT_EVENT, onPrompt)
    return () => window.removeEventListener(APP_PROMPT_EVENT, onPrompt)
  }, [])
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    setInApp(isInApp())
  }, [])

  const loadPicks = useCallback(async () => {
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: getShopperSignals() }),
        cache: 'no-store',
      })
      const data = res.ok ? await res.json() : null
      setSections(Array.isArray(data?.sections) ? data.sections : [])
      setProfile(data?.profile ?? null)
    } catch {
      setSections([])
    }
  }, [])

  // Fresh picks each time it opens, and when the shopper does something new.
  useEffect(() => {
    if (!open) return
    void loadPicks()
    const refresh = () => void loadPicks()
    window.addEventListener(MEMORY_EVENT, refresh)
    return () => window.removeEventListener(MEMORY_EVENT, refresh)
  }, [open, loadPicks])

  // Close on Escape; keep the page behind still on phones.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    const small = window.matchMedia('(max-width: 1023px)').matches
    const before = document.body.style.overflow
    if (small) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [open])

  // Close when the page changes (a product was opened from the panel).
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (text: string) => {
    const content = text.trim().slice(0, 400)
    if (!content || sending) return
    const next: Message[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.slice(-8).map((m) => ({ role: m.role, content: m.content })),
          signals: getShopperSignals(),
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.content) throw new Error('no answer')
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: String(data.content), products: Array.isArray(data.products) ? data.products.slice(0, 8) : [] },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Sorry, I could not answer just now. Please try again in a moment, or use search.' },
      ])
    } finally {
      setSending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  if (!mounted || inApp || HIDDEN_ON.test(pathname)) return null

  const desktopOnly = DESKTOP_ONLY_ON.test(pathname)
  // The free-delivery bar sits above the bottom nav when the cart has items.
  const raised = cartCount > 0
  const close = () => setOpen(false)
  const knows = profile && profile.strength > 0

  return (
    <>
      {/* Launcher */}
      {!open && !appPrompt ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the Upaharo gift helper"
          className={`fixed right-4 z-[55] h-[52px] items-center gap-2 rounded-full bg-ink pl-3.5 pr-3.5 text-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.55)] transition hover:bg-black active:scale-95 lg:bottom-6 lg:right-6 lg:flex lg:pr-5 ${
            desktopOnly ? 'hidden' : 'flex'
          } ${raised ? 'bottom-[calc(140px+env(safe-area-inset-bottom))] lg:bottom-6' : 'bottom-[calc(76px+env(safe-area-inset-bottom))]'}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand">
            <Sparkle className="h-4 w-4" />
          </span>
          <span className="hidden text-[14px] font-bold lg:inline">Ask Upaharo</span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[60] lg:pointer-events-none" role="dialog" aria-modal="true" aria-label="Upaharo gift helper">
          <button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-black/40 lg:hidden" />

          <div className="absolute inset-x-0 bottom-0 top-[6vh] flex flex-col overflow-hidden rounded-t-[28px] bg-white lg:pointer-events-auto lg:inset-auto lg:bottom-6 lg:right-6 lg:top-auto lg:h-[min(680px,calc(100vh-48px))] lg:w-[400px] lg:rounded-[28px] lg:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.45)] lg:ring-1 lg:ring-ink/[0.06]">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-ink/[0.06] px-4 py-3.5">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white">
                <Sparkle />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-extrabold leading-tight text-ink">Upaharo helper</p>
                <p className="truncate text-[12px] text-ink/50">Finds gifts from what you browse and ask</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close the helper"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-mist text-ink hover:bg-mist-deep"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* Conversation and picks */}
            <div ref={bodyRef} className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
              <div className="max-w-[86%] rounded-[20px] rounded-tl-md bg-mist px-3.5 py-2.5 text-[14px] leading-snug text-ink">
                {knows
                  ? 'Hi again! Here are some picks from what you have been looking at. Or tell me who the gift is for and your budget.'
                  : 'Hi! Tell me who the gift is for, the occasion and your budget, and I will find it.'}
              </div>

              {knows ? (
                <div className="rounded-[20px] border border-ink/[0.07] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">What I have noticed</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProfile(null)
                        // Device history first; then anything saved on the account.
                        void fetch('/api/assistant', { method: 'DELETE' })
                          .catch(() => null)
                          .finally(() => clearShopperMemory())
                      }}
                      className="text-[12px] font-semibold text-ink/50 underline-offset-2 hover:text-ink hover:underline"
                    >
                      Clear my history
                    </button>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-ink/70">
                    {profile!.categories.length ? (
                      <>
                        You like <b className="font-semibold text-ink">{profile!.categories.slice(0, 2).join(' and ')}</b>
                        {profile!.priceBand ? (
                          <>
                            , usually around <b className="whitespace-nowrap font-semibold text-ink">{formatPriceNoDecimals(profile!.priceBand.typical)}</b>
                          </>
                        ) : null}
                        .
                      </>
                    ) : (
                      'I will learn what you like as you browse.'
                    )}
                  </p>
                  {profile!.searches.length ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {profile!.searches.slice(0, 4).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => void send(q)}
                          className="rounded-full bg-mist px-3 py-1 text-[12px] font-semibold text-ink hover:bg-mist-deep"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2.5 text-[11px] text-ink/40">Clearing removes it from this device and your account.</p>
                </div>
              ) : null}

              {sections === null ? (
                <div className="flex gap-3 overflow-hidden">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-[136px] flex-shrink-0">
                      <div className="aspect-square animate-pulse rounded-2xl bg-mist" />
                      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-mist" />
                    </div>
                  ))}
                </div>
              ) : (
                sections.map((section) => (
                  <section key={section.key}>
                    <h3 className="text-[16px] font-extrabold tracking-tight text-ink">{section.title}</h3>
                    {section.note ? <p className="text-[12px] text-ink/50">{section.note}</p> : null}
                    <div className="mt-2.5">
                      <Rail products={section.products} onOpen={close} />
                    </div>
                  </section>
                ))
              )}

              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="ml-auto w-fit max-w-[86%] rounded-[20px] rounded-tr-md bg-ink px-3.5 py-2.5 text-[14px] leading-snug text-white">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="space-y-3">
                    <div className="w-fit max-w-[86%] whitespace-pre-line rounded-[20px] rounded-tl-md bg-mist px-3.5 py-2.5 text-[14px] leading-snug text-ink">
                      {m.content}
                    </div>
                    {m.products && m.products.length ? <Rail products={m.products} onOpen={close} /> : null}
                  </div>
                )
              )}

              {sending ? (
                <div className="flex w-fit items-center gap-1 rounded-[20px] rounded-tl-md bg-mist px-4 py-3" aria-label="Thinking">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Ask */}
            <div className="border-t border-ink/[0.06] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 lg:pb-3">
              {messages.length === 0 ? (
                <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 scrollbar-hide">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="flex-shrink-0 rounded-full bg-mist px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-mist-deep"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              <form onSubmit={onSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. cake for mom under Rs 1,500"
                  maxLength={400}
                  className="h-12 min-w-0 flex-1 rounded-full bg-mist px-4 text-[15px] text-ink outline-none placeholder:text-ink/40 focus:bg-white focus:ring-2 focus:ring-ink/15"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-ink text-white transition disabled:bg-ink/20"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
