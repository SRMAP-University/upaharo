import Link from 'next/link'
import { BouquetArt, CakeArt, GiftBoxArt } from '@/components/home/GiftArt'

/** Home "Play & Win" card: opens Gift Catch (win up to 10% off). */
export default function PlayWinCard() {
  return (
    <Link
      href="/play"
      className="group relative flex items-center gap-3 overflow-hidden rounded-[24px] bg-gradient-to-r from-[#FFF3DC] via-[#FFF0EC] to-[#FDE3E1] px-4 py-3.5 ring-1 ring-ink/[0.06] transition active:scale-[0.99] lg:rounded-[28px] lg:px-7 lg:py-5"
    >
      <div className="relative h-[64px] w-[78px] flex-shrink-0 lg:h-[84px] lg:w-[104px]">
        <CakeArt className="absolute -left-1 bottom-0 h-[44px] w-[44px] -rotate-12 transition-transform duration-500 group-hover:-translate-y-1 lg:h-[58px] lg:w-[58px]" />
        <BouquetArt className="absolute -right-1 bottom-1 h-[44px] w-[44px] rotate-12 transition-transform duration-500 group-hover:-translate-y-1.5 lg:h-[58px] lg:w-[58px]" />
        <GiftBoxArt className="absolute left-1/2 top-0 h-[46px] w-[46px] -translate-x-1/2 transition-transform duration-500 group-hover:-translate-y-2 lg:h-[60px] lg:w-[60px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">Play &amp; Win</p>
        <p className="text-[17px] font-extrabold leading-tight text-ink lg:text-[22px]">Catch gifts, win up to 10% off</p>
        <p className="mt-0.5 text-[12px] text-ink/55 lg:text-[13px]">A 45-second game. One coupon a day.</p>
      </div>
      <span className="flex h-10 flex-shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-bold text-white lg:h-11 lg:px-5 lg:text-[14px]">
        Play
      </span>
    </Link>
  )
}
