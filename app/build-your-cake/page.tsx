import type { Metadata } from 'next'
import { Suspense } from 'react'
import CakeBuilder from '@/components/cake/CakeBuilder'

export const metadata: Metadata = {
  title: 'Build Your Own Cake | Upaharo',
  description:
    'Design your own cake on Upaharo: choose the size, flavour, toppings and message, see a live preview and order it for delivery in Kathmandu.',
}

export default function BuildYourCakePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF8F8]" />}>
      <CakeBuilder />
    </Suspense>
  )
}
