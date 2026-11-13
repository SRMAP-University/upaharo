import { formatPriceNoDecimals } from '@/lib/utils'

const icons = {
  bolt: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  map: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 4 3.5 6v14L9 18m0-14 6 2m-6-2v14m6-12 5.5-2v14L15 20m0-14v14m0 0-6-2" />
  ),
  truck: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 6.5h11v9H3zM14 9.5h3.5L21 13v2.5h-7M7.5 18.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm11 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
  ),
  shield: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-2.5 8.5 1.8 1.8 3.7-3.8" />,
}

/** The shop's promises, from the live delivery settings. */
export default function TrustStrip({
  freeDeliveryMin,
  deliveryFee,
  deliveryEstimate,
}: {
  freeDeliveryMin?: number
  deliveryFee?: number
  /** Admin → Settings delivery time outside Kathmandu, e.g. "2-3 days". */
  deliveryEstimate?: string
}) {
  const estimate = String(deliveryEstimate || '').trim()
  const free = Number(freeDeliveryMin) || 0
  const fee = Number(deliveryFee) || 0
  const features = [
    { icon: icons.bolt, title: 'Same day in Kathmandu', copy: 'Order before the cut-off and it arrives today.' },
    { icon: icons.map, title: 'All of Nepal', copy: /\d/.test(estimate) ? `About ${estimate.replace(/-/g, '–')} to other cities.` : 'Delivery to cities across Nepal.' },
    free > 0
      ? {
          icon: icons.truck,
          title: `Free delivery over ${formatPriceNoDecimals(free)}`,
          copy: fee > 0 ? `${formatPriceNoDecimals(fee)} on smaller orders.` : 'On every order above it.',
        }
      : { icon: icons.truck, title: 'Careful delivery', copy: 'Packed by hand, delivered with care.' },
    { icon: icons.shield, title: 'Safe checkout', copy: 'Secure payments and real people on support.' },
  ]

  return (
    <section className="grid grid-cols-2 gap-x-3 gap-y-5 rounded-[24px] bg-mist p-5 lg:grid-cols-4 lg:gap-6 lg:p-7">
      {features.map((feature) => (
        <div key={feature.title} className="flex flex-col gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              {feature.icon}
            </svg>
          </span>
          <h3 className="text-[14px] font-bold leading-snug text-ink lg:text-base">{feature.title}</h3>
          <p className="text-[12px] leading-relaxed text-ink/55 lg:text-[13px]">{feature.copy}</p>
        </div>
      ))}
    </section>
  )
}
