'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BouquetArt, CakeArt, GiftBoxArt } from '@/components/home/GiftArt'
import { createGiftCatch, GAME_SECONDS } from '@/components/play/giftCatchEngine'

/**
 * Gift Catch, the "Play & Win" game: 45 seconds of catching falling gifts.
 * Play as often as you like; one coupon a day (up to 10% off) for the score.
 * The server checks the game and decides the discount (see /api/promo/catch).
 */

type Tier = { min: number; percent: number }
type Claimed = { percent: number; code: string | null; endAt: string | null }
type Status = { signedIn: boolean; claimed: Claimed | null; tiers: Tier[] }

const DEFAULT_TIERS: Tier[] = [
  { min: 20, percent: 3 },
  { min: 50, percent: 5 },
  { min: 90, percent: 7 },
  { min: 140, percent: 10 },
]
const PENDING_KEY = 'gift-catch-pending'
const BEST_KEY = 'gift-catch-best'

function percentFor(score: number, tiers: Tier[]) {
  let percent = 0
  for (const tier of tiers) if (score >= tier.min) percent = tier.percent
  return percent
}

function CloudIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" strokeLinecap="round" aria-hidden>
      <path d="M30 70a16 16 0 0 1 12-26 22 22 0 0 1 40-4 16 16 0 0 1 12 30z" fill="#D6DEEC" stroke="#8C9AB8" strokeWidth={3} />
      <path d="M44 82l-4 10M60 82l-4 10M76 82l-4 10" stroke="#6F8FE8" strokeWidth={3} />
    </svg>
  )
}

function CouponCard({ claimed }: { claimed: Claimed }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/60 p-4 text-center">
      <p className="text-[13px] font-semibold text-ink/60">Your {claimed.percent}% off coupon</p>
      <p className="mt-1 font-mono text-[22px] font-extrabold tracking-wider text-ink">{claimed.code}</p>
      {claimed.code ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(claimed.code!).then(() => setCopied(true))
          }}
          className="mt-2 inline-flex h-9 items-center rounded-full bg-white px-4 text-[13px] font-bold text-ink ring-1 ring-ink/10"
        >
          {copied ? 'Copied' : 'Copy code'}
        </button>
      ) : null}
      <p className="mt-2 text-[11.5px] text-ink/50">
        One use{claimed.endAt ? `, valid until ${new Date(claimed.endAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}. Apply it at checkout.
      </p>
    </div>
  )
}

export default function GiftCatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<ReturnType<typeof createGiftCatch> | null>(null)
  const tokenRef = useRef<string | null>(null)
  const [phase, setPhase] = useState<'intro' | 'count' | 'play' | 'over'>('intro')
  const [count, setCount] = useState(3)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState<Status | null>(null)
  const [pending, setPending] = useState<{ token: string; score: number } | null>(null)
  const [claimed, setClaimed] = useState<Claimed | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const tiers = status?.tiers?.length ? status.tiers : DEFAULT_TIERS
  const tiersRef = useRef(tiers)
  tiersRef.current = tiers

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/promo/catch', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as Status
      setStatus(data)
      if (data.claimed) setClaimed(data.claimed)
    } catch {
      // the game still works without it
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    try {
      const m = localStorage.getItem('gift-catch-muted') === '1'
      setMuted(m)
      gameRef.current?.setMuted(m)
      setBest(Number(localStorage.getItem(BEST_KEY)) || 0)
      const raw = sessionStorage.getItem(PENDING_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { token: string; score: number; at: number }
        if (Date.now() - saved.at < 2 * 60 * 60 * 1000) setPending({ token: saved.token, score: saved.score })
        else sessionStorage.removeItem(PENDING_KEY)
      }
    } catch {
      // storage blocked
    }
  }, [loadStatus])

  useEffect(() => {
    if (!canvasRef.current) return
    const game = createGiftCatch(canvasRef.current, {
      tiers: tiersRef.current,
      onEnd: (final) => {
        setScore(final)
        setBest((b) => {
          const next = Math.max(b, final)
          try {
            localStorage.setItem(BEST_KEY, String(next))
          } catch {
            // ignore
          }
          return next
        })
        setPhase('over')
      },
    })
    gameRef.current = game
    return () => game.destroy()
  }, [])

  const play = async () => {
    setError('')
    tokenRef.current = null
    setPhase('count')
    setCount(3)
    const tokenReq = fetch('/api/promo/catch/start', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        tokenRef.current = d?.token ?? null
      })
      .catch(() => undefined)
    for (const n of [3, 2, 1]) {
      setCount(n)
      gameRef.current?.beep(false)
      await new Promise((r) => setTimeout(r, 700))
    }
    gameRef.current?.beep(true)
    await tokenReq
    setPhase('play')
    gameRef.current?.start()
  }

  const claim = async (token: string, finalScore: number) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/promo/catch/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, score: finalScore }),
      })
      if (res.status === 401) {
        // Keep this game and come back after signing in.
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ token, score: finalScore, at: Date.now() }))
        } catch {
          // ignore
        }
        window.location.assign('/login?next=/play')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not claim the coupon')
      try {
        sessionStorage.removeItem(PENDING_KEY)
      } catch {
        // ignore
      }
      setPending(null)
      if (data.code) setClaimed({ percent: data.percent, code: data.code, endAt: data.endAt })
      else if (data.percent === 0) setError('Score a little higher to win a coupon.')
      void loadStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim the coupon')
    } finally {
      setBusy(false)
    }
  }

  const won = percentFor(score, tiers)
  const nextTier = tiers.find((t) => score < t.min)

  const toggleMute = () => {
    const m = !muted
    setMuted(m)
    gameRef.current?.setMuted(m)
    try {
      localStorage.setItem('gift-catch-muted', m ? '1' : '0')
    } catch {
      // ignore
    }
  }

  const card =
    'w-full max-w-[340px] rounded-[28px] bg-white/95 p-6 text-center shadow-[0_24px_60px_-24px_rgba(90,30,40,0.45)] ring-1 ring-ink/[0.06] backdrop-blur'

  return (
    <div className="fixed inset-0 z-[60] select-none overflow-hidden bg-[#FFF7F2]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full touch-none"
        aria-label="Gift Catch game: move the scooter to catch gifts in the crate"
      />

      {/* corner buttons */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-[calc(10px+env(safe-area-inset-top))]">
        <Link
          href="/"
          aria-label="Close the game"
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm ring-1 ring-ink/[0.06]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </Link>
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[13px] font-extrabold text-ink shadow-sm ring-1 ring-ink/[0.06]">
          Play &amp; Win
        </span>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? 'Sound on' : 'Sound off'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow-sm ring-1 ring-ink/[0.06]"
        >
          {muted ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinejoin="round" d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
              <path strokeLinecap="round" d="M16 9.5l5 5M21 9.5l-5 5" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinejoin="round" d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" />
              <path strokeLinecap="round" d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
            </svg>
          )}
        </button>
      </div>

      {pending && status?.signedIn && !claimed && phase !== 'play' ? (
        <div className="absolute inset-x-3 top-[calc(60px+env(safe-area-inset-top))] mx-auto flex max-w-[400px] items-center justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-sm ring-1 ring-ink/[0.06]">
          <p className="text-[13px] font-semibold text-ink">
            Your last game scored {pending.score}. Claim your {percentFor(pending.score, tiers)}% coupon.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void claim(pending.token, pending.score)}
            className="flex-shrink-0 rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white"
          >
            Claim
          </button>
        </div>
      ) : null}

      {phase === 'intro' ? (
        <div className="absolute inset-0 flex items-center justify-center px-5">
          <div className={card}>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand">Play &amp; Win</p>
            <h2 className="mt-1 text-[30px] font-extrabold leading-tight tracking-tight text-ink">Gift Catch</h2>
            <p className="mx-auto mt-1 max-w-[260px] text-[14px] text-ink/60">
              Ride the scooter and catch the falling gifts in your crate. Dodge the rain clouds!
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2 text-[11px] font-bold text-ink">
              <span className="flex flex-col items-center"><GiftBoxArt className="h-11 w-11" />+1</span>
              <span className="flex flex-col items-center"><CakeArt className="h-11 w-11" />+2</span>
              <span className="flex flex-col items-center"><BouquetArt className="h-11 w-11" />+3</span>
              <span className="flex flex-col items-center"><CloudIcon className="h-11 w-11" />−3</span>
            </div>
            <p className="mt-3 text-[12px] font-semibold text-ink/55">Golden gift +5 · Bubbles: magnet, +5s, double points</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {tiers.map((t) => (
                <span key={t.min} className="rounded-full bg-mist px-2.5 py-1 text-[11.5px] font-semibold text-ink">
                  {t.min}+ = {t.percent}% off
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void play()}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand text-[16px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(232,50,43,0.7)] active:scale-95"
            >
              Play
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-ink/45">
              {claimed
                ? 'You have won today’s coupon. Play for fun!'
                : 'Play as often as you like. One coupon per account a day, single use, valid 7 days.'}
            </p>
          </div>
        </div>
      ) : null}

      {phase === 'count' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span key={count} className="hs-rise text-[110px] font-extrabold text-brand drop-shadow-[0_4px_0_#fff]">
            {count}
          </span>
        </div>
      ) : null}

      {phase === 'over' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/30 px-5">
          <div className={card}>
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-ink/50">Time&rsquo;s up</p>
            <p className="mt-1 text-[60px] font-extrabold leading-none text-ink">{score}</p>
            <p className="mt-1 text-[12.5px] text-ink/50">Best: {Math.max(best, score)}</p>

            <div className="mt-4">
              {claimed ? (
                <>
                  <CouponCard claimed={claimed} />
                  <p className="mt-2 text-[12px] text-ink/50">One coupon a day. Come back tomorrow to win again.</p>
                </>
              ) : won > 0 ? (
                <>
                  <p className="text-[19px] font-extrabold text-ink">
                    You won <span className="text-brand">{won}% off</span>!
                  </p>
                  {nextTier ? (
                    <p className="text-[12px] text-ink/50">
                      Score {nextTier.min} for {nextTier.percent}% next time.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !tokenRef.current}
                    onClick={() => tokenRef.current && void claim(tokenRef.current, score)}
                    className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-bold text-white disabled:opacity-50"
                  >
                    {busy ? 'Claiming…' : status?.signedIn ? `Claim my ${won}% coupon` : 'Sign in to claim'}
                  </button>
                  {!tokenRef.current ? (
                    <p className="mt-2 text-[11.5px] text-ink/50">Could not reach the shop to save this game. Try another round.</p>
                  ) : null}
                </>
              ) : (
                <p className="text-[15px] font-semibold text-ink/70">Score {tiers[0].min} to win a coupon. You can do it!</p>
              )}
              {error ? <p className="mt-2 text-[12.5px] font-semibold text-brand">{error}</p> : null}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void play()}
                className="inline-flex h-11 items-center rounded-full bg-mist px-5 text-[14px] font-bold text-ink"
              >
                Play again
              </button>
              <Link href="/" className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-[14px] font-bold text-white">
                Shop now
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
