import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Upaharo Business | Wholesale',
  description:
    'Wholesale cakes, flowers and gifts for cafés, hotels, event planners and local shops.',
  robots: {
    index: true,
    follow: true,
  },
}

/**
 * Isolated B2B shell — no retail Header/BottomNav (those pull in cart/orders).
 */
export default function B2BLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F7F2EE] text-ink antialiased" data-b2b-site>
      {children}
    </div>
  )
}
