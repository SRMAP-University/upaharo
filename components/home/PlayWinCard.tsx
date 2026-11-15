import Link from 'next/link'
import { GiftBoxArt } from '@/components/home/GiftArt'

/** Home "Play & Win" strip: one slim line that opens Gift Catch (up to 10% off). */
export default function PlayWinCard() {
  return (
    <Link
      href="/play"
      className="group flex h-[50px] items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FFF3DC] via-[#FFF0EC] to-[#FDE3E1] pl-1.5 pr-1.5 ring-1 ring-ink/[0.06] transition active:scale-[0.99] lg:h-[56px] lg:pl-2"
    >
      <GiftBoxArt className="h-10 w-10 flex-shrink-0 transition-transform duration-500 group-hover:-translate-y-0.5 lg:h-11 lg:w-11" />
      <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink lg:text-[15px]">
        <span className="text-brand">Play &amp; Win</span>
        <span className="font-medium text-ink/60"> · win up to 10% off</span>
      </p>
      <span className="flex h-9 flex-shrink-0 items-center rounded-xl bg-ink px-3.5 text-[12.5px] font-bold text-white lg:h-10 lg:px-4">
        Play
      </span>
    </Link>
  )
}
