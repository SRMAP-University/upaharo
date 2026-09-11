import Link from 'next/link'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { PLAY_STORE_APP_URL } from '@/lib/app-download'

export const metadata = {
  title: 'Spin & Win | Upaharo',
  description: 'Play daily Spin & Win in the Upaharo Gifts app for extra savings.',
}

export default function PromoPage() {
  return (
    <main className="min-h-screen bg-cream">
      <Header />
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6 lg:pb-16">
        <section className="overflow-hidden rounded-[28px] border border-blush/20 bg-gradient-to-br from-blush-soft via-white to-cream p-6 text-center shadow-[0_28px_60px_-40px_rgba(232,90,140,0.45)] lg:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blush">
            Daily rewards
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink lg:text-4xl">
            Spin &amp; Win
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink/60 lg:text-base">
            Open the Upaharo Gifts app to spin once a day for 5%–30% off. The
            full game, extra rewards, and your coupons live in the app.
          </p>

          <div className="mx-auto mt-8 flex h-40 w-40 items-center justify-center rounded-full border-[10px] border-blush/25 bg-white shadow-inner">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blush text-white">
              <span className="font-display text-2xl font-semibold">Spin</span>
            </div>
          </div>

          <a
            href={PLAY_STORE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-wine"
          >
            Download the app
          </a>
          <p className="mt-3 text-xs text-ink/45">
            Available on Google Play · Upaharo Gifts
          </p>
        </section>

        <section className="mt-6 rounded-[24px] border border-wine/10 bg-white p-5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Why get the app
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/65">
            <li>Daily Spin &amp; Win coupons you can use at checkout</li>
            <li>Live order tracking and delivery updates</li>
            <li>Faster reorder from your saved addresses</li>
          </ul>
          <a
            href={PLAY_STORE_APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-bold text-blush hover:text-wine"
          >
            Get it on Google Play →
          </a>
        </section>

        <p className="mt-6 text-center text-sm text-ink/50">
          Prefer the website?{' '}
          <Link href="/" className="font-semibold text-wine hover:underline">
            Continue shopping
          </Link>
        </p>
      </div>
      <BottomNav />
    </main>
  )
}
