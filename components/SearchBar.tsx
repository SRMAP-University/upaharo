'use client'

import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const router = useRouter()

  return (
    <div>
      <div className="sticky top-14 z-30 bg-cream/90 backdrop-blur px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Search gifts, flowers, cakes..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-wine/15 rounded-full text-sm shadow-[0_14px_36px_-30px_rgba(17,17,17,0.7)] focus:outline-none focus:ring-2 focus:ring-wine/15 focus:border-wine/40 text-ink placeholder-ink/40 cursor-pointer"
              onClick={() => router.push('/search')}
              readOnly
            />
            <svg className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wine pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
