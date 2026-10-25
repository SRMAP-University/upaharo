import Link from 'next/link'
import { bhaiTikaCountdown } from '@/lib/festival-dates'
import {
  DiyaRow,
  FallingPetals,
  MarigoldGarland,
  Sparkles,
  festiveStyles,
} from '@/components/festive/FestiveDecor'

/** Home page doorway to the Bhai Tika collection (shown while festival mode is on). */
export default function BhaiTikaEntry() {
  const countdown = bhaiTikaCountdown()
  const countdownText = countdown
    ? countdown.daysLeft === 0
      ? 'Today!'
      : countdown.daysLeft === 1
        ? '1 day to go'
        : `${countdown.daysLeft} days to go`
    : null

  return (
    <Link
      href="/bhai-tika"
      className="group relative block overflow-hidden rounded-[24px] bg-[radial-gradient(120%_120%_at_20%_0%,#9b2c4f_0%,#5d1d34_55%,#3a0f20_100%)] px-5 pb-5 pt-[72px] text-white shadow-[0_24px_50px_-30px_rgba(58,15,32,0.9)] lg:rounded-[30px] lg:px-10 lg:pb-9 lg:pt-28"
      aria-label="Explore Bhai Tika gifts"
    >
      <MarigoldGarland className="pointer-events-none absolute inset-x-0 top-0 h-[64px] w-full lg:h-[100px]" />
      <Sparkles count={9} />
      <FallingPetals count={10} fall={340} />

      <div className="relative flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Tihar special
            {countdownText ? (
              <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold normal-case tracking-normal text-[#3a0f20]">
                {countdownText}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-3 leading-none">
            <span className={`${festiveStyles.shimmerText} text-[38px] font-bold tracking-tight lg:text-6xl`}>
              Bhai Tika
            </span>
            <span className="text-xl font-semibold text-amber-200 lg:text-3xl" lang="ne">
              भाइटीका
            </span>
          </p>
          <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-white/75 lg:text-base">
            Tika sets, hampers and gifts for your brother or sister.
          </p>
          <span className="mt-4 inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-400 px-4 text-sm font-semibold text-[#3a0f20] transition group-hover:bg-amber-300 lg:h-12 lg:px-5 lg:text-[15px]">
            <span className="sm:hidden">Explore</span>
            <span className="hidden sm:inline">Explore the collection</span>
            <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
          </span>
        </div>
        <DiyaRow
          count={3}
          className="relative -mb-1 h-[52px] w-[140px] flex-shrink-0 self-end sm:h-[64px] sm:w-[180px] lg:h-[88px] lg:w-[250px]"
        />
      </div>
    </Link>
  )
}
