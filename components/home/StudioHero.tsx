import Image from 'next/image'
import Link from 'next/link'
import { resolveImageUrl } from '@/lib/image-url'

/**
 * Studio home hero: a red card with one clear message and real products in
 * round frames, then quick links to the shop's occasions.
 */

type HeroProduct = { id: string; name: string; image: string }
type Occasion = { id: string; name: string }

function Round({ product, className, sizes }: { product: HeroProduct; className: string; sizes: string }) {
  return (
    <Link
      href={`/products/${product.id}`}
      aria-label={product.name}
      className={`absolute block overflow-hidden rounded-full bg-white ring-[6px] ring-white/20 transition-transform duration-500 [@media(hover:hover)]:hover:scale-[1.03] ${className}`}
    >
      <Image src={resolveImageUrl(product.image)} alt={product.name} fill sizes={sizes} quality={75} className="object-cover" />
    </Link>
  )
}

export default function StudioHero({
  products,
  occasions,
  promise,
}: {
  products: HeroProduct[]
  occasions: Occasion[]
  /** Short delivery line under the headline. */
  promise: string
}) {
  const [first, second, third] = products

  return (
    <div>
      <section className="relative overflow-hidden rounded-[28px] bg-brand text-white lg:rounded-[36px]">
        <div className="relative z-10 p-6 pb-7 sm:p-8 lg:max-w-[700px] lg:px-14 lg:py-16">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/80">Same day in Kathmandu</p>
          <h1 className="mt-2 text-[34px] font-extrabold leading-[1.02] tracking-tight sm:text-[44px] lg:text-[60px]">
            Make someone&rsquo;s
            <br />
            day today.
          </h1>
          <p className="mt-3 max-w-[210px] text-[14px] leading-snug text-white/85 sm:max-w-sm lg:text-[17px]">{promise}</p>
          <Link
            href="/search"
            className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-[14px] font-bold text-ink transition hover:bg-mist lg:mt-8 lg:h-[52px] lg:px-7 lg:text-[15px]"
          >
            Send a gift <span aria-hidden>→</span>
          </Link>
        </div>

        {/* Phone: one big round photo tucked into the corner. */}
        {first ? (
          <Round product={first} sizes="180px" className="-bottom-8 -right-10 h-[176px] w-[176px] sm:h-[220px] sm:w-[220px] lg:hidden" />
        ) : null}

        {/* Desktop: three round photos on the right. */}
        {first ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] lg:block">
            <div className="pointer-events-auto">
              <Round product={first} sizes="360px" className="right-[14%] top-1/2 h-[340px] w-[340px] -translate-y-1/2" />
              {second ? <Round product={second} sizes="170px" className="left-[2%] top-[10%] h-[150px] w-[150px]" /> : null}
              {third ? <Round product={third} sizes="140px" className="bottom-[8%] left-[10%] h-[120px] w-[120px]" /> : null}
            </div>
          </div>
        ) : null}
      </section>

      {occasions.length > 0 ? (
        <nav aria-label="Occasions" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide sm:mx-0 sm:px-0 lg:mt-6">
          <Link href="/search" className="u-chip u-chip-active flex-shrink-0">
            All gifts
          </Link>
          {occasions.map((o) => (
            <Link key={o.id} href={`/categories/${o.id}`} className="u-chip flex-shrink-0">
              {o.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
