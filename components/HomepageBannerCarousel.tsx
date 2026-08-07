'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { resolveImageUrl } from '@/lib/image-url'

type Banner = {
  id: string
  title: string
  subtitle?: string | null
  image: string
  link?: string | null
}

const BANNER_DURATION = 5500

export default function HomepageBannerCarousel({ banners }: { banners: Banner[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (banners.length <= 1 || paused) return

    const interval = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % banners.length)
    }, BANNER_DURATION)

    return () => window.clearTimeout(interval)
  }, [banners.length, activeIndex, paused])

  if (banners.length === 0) {
    return null
  }

  const activeBanner = banners[activeIndex]
  const imageUrl = resolveImageUrl(activeBanner.image)

  const content = (
    <div className="group relative overflow-hidden rounded-[30px] border border-blush/15 bg-white p-[3px] shadow-[0_28px_60px_-40px_rgba(232,90,140,0.45)] ring-1 ring-blush/20">
      <div className="relative min-h-[230px] overflow-hidden rounded-[27px] bg-gradient-to-br from-blush-soft to-cream-deep md:min-h-[300px]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={activeBanner.id}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                opacity: { duration: 1, ease: 'easeOut' },
                scale: { duration: BANNER_DURATION / 1000 + 1.4, ease: 'linear' },
              },
            }}
            exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
            className="absolute inset-0"
          >
            <Image
              src={imageUrl}
              alt={activeBanner.title}
              fill
              priority={activeIndex === 0}
              quality={78}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              sizes="(max-width: 768px) 100vw, 70vw"
            />
          </motion.div>
        </AnimatePresence>

        {/* Soft inner edge so the artwork sits gently inside the cream frame */}
        <div className="pointer-events-none absolute inset-0 rounded-[27px] shadow-[inset_0_0_0_1px_rgba(232,90,140,0.08)]" />
      </div>
    </div>
  )

  return (
    <div className="space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {activeBanner.link ? <Link href={activeBanner.link}>{content}</Link> : content}

      {banners.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="relative h-1.5 overflow-hidden rounded-full bg-blush/20 transition-all"
              style={{ width: activeIndex === index ? 34 : 14 }}
              aria-label={`Show banner ${index + 1}`}
            >
              {activeIndex === index ? (
                <motion.span
                  key={activeIndex}
                  className="absolute inset-y-0 left-0 rounded-full bg-blush"
                  initial={{ width: '0%' }}
                  animate={{ width: paused ? '35%' : '100%' }}
                  transition={{ duration: paused ? 0.3 : BANNER_DURATION / 1000, ease: 'linear' }}
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
