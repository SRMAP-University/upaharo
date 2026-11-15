import type { Metadata, Viewport } from 'next'
import GiftCatch from '@/components/play/GiftCatch'

export const metadata: Metadata = {
  title: 'Play & Win: Gift Catch | Upaharo',
  description: 'Ride the Upaharo scooter, catch the falling gifts and win a coupon of up to 10% off. One coupon a day.',
}

export const viewport: Viewport = { themeColor: '#FFF7F2' }

export default function PlayPage() {
  return <GiftCatch />
}
