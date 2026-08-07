'use client'

import Link from 'next/link'
import GiftLoginHero from '@/components/auth/GiftLoginHero'
import PhoneOtpForm from '@/components/auth/PhoneOtpForm'

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-white md:flex md:min-h-screen">
      <Link
        href="/"
        className="absolute right-4 top-4 z-20 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#1A1A1A] shadow-sm md:right-6 md:top-6"
      >
        Skip
      </Link>

      <div className="h-[42vh] min-h-[260px] w-full md:h-auto md:min-h-screen md:w-[48%] md:max-w-xl">
        <GiftLoginHero />
      </div>

      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[28px] bg-white px-5 pb-8 pt-6 shadow-[0_-8px_30px_rgba(92,42,58,0.08)] md:mt-0 md:justify-center md:rounded-none md:px-10 md:shadow-none lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-5 flex justify-center md:hidden">
            <div className="h-1.5 w-12 rounded-full bg-black/10" />
          </div>
          <PhoneOtpForm />
        </div>
      </div>
    </div>
  )
}
