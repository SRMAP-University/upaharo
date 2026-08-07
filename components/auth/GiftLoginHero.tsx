'use client'

type GiftChip = { emoji: string; label: string; tint: string }

const ROW_A: GiftChip[] = [
  { emoji: '💐', label: 'Bouquet', tint: '#FFE0EC' },
  { emoji: '🎂', label: 'Cake', tint: '#FFF0D6' },
  { emoji: '🍫', label: 'Chocolate', tint: '#F3E0D4' },
  { emoji: '🧸', label: 'Teddy', tint: '#E8F0FF' },
  { emoji: '🌹', label: 'Roses', tint: '#FFD6E0' },
  { emoji: '🎁', label: 'Hamper', tint: '#E8FFE8' },
  { emoji: '🕯️', label: 'Candles', tint: '#FFF6D8' },
  { emoji: '💍', label: 'Jewelry', tint: '#F0E8FF' },
  { emoji: '🎈', label: 'Balloons', tint: '#E0F4FF' },
  { emoji: '🧁', label: 'Cupcakes', tint: '#FFE8F2' },
  { emoji: '🌿', label: 'Plants', tint: '#E4F5E8' },
  { emoji: '🍾', label: 'Celebration', tint: '#FFEFD8' },
]

const ROW_B: GiftChip[] = [
  { emoji: '🎀', label: 'Gift wrap', tint: '#FFE4F0' },
  { emoji: '🍪', label: 'Cookies', tint: '#FFF2DC' },
  { emoji: '🌸', label: 'Orchid', tint: '#F8E0F0' },
  { emoji: '💌', label: 'Cards', tint: '#FFE8E0' },
  { emoji: '🍩', label: 'Donuts', tint: '#FFE6F4' },
  { emoji: '🥂', label: 'Toast', tint: '#E8F4FF' },
  { emoji: '🌻', label: 'Sunflower', tint: '#FFF4C8' },
  { emoji: '🥝', label: 'Fruit box', tint: '#E4FFE8' },
  { emoji: '📿', label: 'Accessories', tint: '#F0E8FF' },
  { emoji: '🍯', label: 'Gourmet', tint: '#FFF0D0' },
  { emoji: '🪄', label: 'Surprise', tint: '#E8ECFF' },
  { emoji: '💝', label: 'Love box', tint: '#FFDCE8' },
]

const ROW_C: GiftChip[] = [
  { emoji: '🌷', label: 'Tulips', tint: '#FFE0F0' },
  { emoji: '🍰', label: 'Pastry', tint: '#FFF0E4' },
  { emoji: '🧸', label: 'Soft toy', tint: '#E8F0FF' },
  { emoji: '🌺', label: 'Exotic', tint: '#FFD8E8' },
  { emoji: '☕', label: 'Coffee set', tint: '#F3E8DC' },
  { emoji: '🎄', label: 'Festive', tint: '#E4F8E8' },
  { emoji: '💎', label: 'Sparkle', tint: '#E8F0FF' },
  { emoji: '🍬', label: 'Sweets', tint: '#FFE8F4' },
  { emoji: '🪴', label: 'Planter', tint: '#E0F5E4' },
  { emoji: '🎻', label: 'Keepsake', tint: '#F8E8FF' },
  { emoji: '🥳', label: 'Party', tint: '#FFEAD4' },
  { emoji: '✨', label: 'Luxury', tint: '#FFE8F0' },
]

function MarqueeRow({
  items,
  reverse,
  durationSec,
}: {
  items: GiftChip[]
  reverse?: boolean
  durationSec: number
}) {
  const sequence = [...items, ...items]
  return (
    <div className="overflow-hidden">
      <div
        className={`flex w-max gap-2.5 ${reverse ? 'animate-gift-marquee-reverse' : 'animate-gift-marquee'}`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {sequence.map((gift, i) => (
          <div
            key={`${gift.label}-${i}`}
            className="flex h-[88px] w-[82px] shrink-0 flex-col items-center justify-center rounded-[18px] border border-white/85 px-1.5 py-2 shadow-[0_4px_10px_rgba(232,90,140,0.12)]"
            style={{ backgroundColor: gift.tint }}
          >
            <span className="text-[30px] leading-none">{gift.emoji}</span>
            <span className="mt-1.5 truncate text-center text-[11px] font-bold text-[#5C2A3A]">
              {gift.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GiftLoginHero() {
  return (
    <div className="relative flex h-full min-h-[280px] flex-col overflow-hidden bg-gradient-to-b from-[#FFE4EC] via-[#FFD0DE] to-[#FFC0D4]">
      <div className="flex flex-1 flex-col justify-center gap-2.5 px-0 pb-16 pt-10">
        <MarqueeRow items={ROW_A} durationSec={28} />
        <MarqueeRow items={ROW_B} reverse durationSec={34} />
        <MarqueeRow items={ROW_C} durationSec={24} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
        <p className="text-[26px] font-extrabold tracking-wide text-[#5C2A3A] drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]">
          Upaharo
        </p>
        <p className="mt-1 text-[13px] font-semibold text-[#5C2A3A]/70">
          Gifts for every occasion
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white to-transparent" />
    </div>
  )
}
