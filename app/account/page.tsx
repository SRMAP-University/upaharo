'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { useUserStore } from '@/lib/store/user'
import { useRouter } from 'next/navigation'

type SupportInfo = {
  phone: string
  email: string
  hours: string
}

function Icon({ d }: { d: string }) {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-soft text-wine">
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
      </svg>
    </span>
  )
}

const ICONS = {
  orders: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z',
  address: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  recipients: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  favorites: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  phone: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z',
  email: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  terms: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  privacy: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
  remove: 'M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z',
}

function Row({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string
  icon: string
  title: string
  subtitle?: string
}) {
  const external = /^(tel|mailto):/.test(href)
  const content = (
    <>
      <Icon d={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-ink/50">{subtitle}</span> : null}
      </span>
      <svg className="h-4 w-4 flex-shrink-0 text-ink/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  )
  const className = 'flex items-center gap-3 px-4 py-3.5 transition hover:bg-cream active:bg-cream-deep'
  return external ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{title}</h2>
      <div className="mt-2 divide-y divide-ink/10 overflow-hidden rounded-3xl border border-ink/10 bg-white">
        {children}
      </div>
    </section>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const { user, logout, _hasHydrated } = useUserStore()
  const [mounted, setMounted] = useState(false)
  const [support, setSupport] = useState<SupportInfo>({ phone: '', email: '', hours: '' })

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { supportPhone?: string; supportEmail?: string; supportHours?: string }) => {
        if (cancelled) return
        setSupport({
          phone: String(data?.supportPhone || '').trim(),
          email: String(data?.supportEmail || '').trim(),
          hours: String(data?.supportHours || '').trim(),
        })
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    logout()
    await signOut({ redirect: false })
    router.push('/')
  }

  if (!mounted || !_hasHydrated) {
    return null
  }

  const contactLine = [user?.phone, user?.email].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-cream pb-24 lg:pb-16">
      <div className="hidden lg:block">
        <Header />
      </div>

      <div className="sticky top-0 z-40 border-b border-ink/10 bg-cream/95 backdrop-blur lg:static lg:border-0 lg:bg-transparent">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 lg:pt-8">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-ink transition hover:bg-cream-deep lg:hidden"
            aria-label="Go back"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-ink lg:text-3xl">Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 lg:py-6">
        {user ? (
          <Link
            href="/profile"
            className="flex items-center gap-4 rounded-3xl border border-ink/10 bg-white p-4 transition hover:bg-cream"
          >
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-wine text-xl font-semibold text-white">
              {user.name?.trim().charAt(0).toUpperCase() || 'U'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-ink">{user.name || 'Your account'}</span>
              {contactLine ? <span className="block truncate text-sm text-ink/55">{contactLine}</span> : null}
              <span className="mt-0.5 block text-xs font-semibold text-wine">View profile</span>
            </span>
            <svg className="h-4 w-4 flex-shrink-0 text-ink/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <div className="rounded-3xl border border-ink/10 bg-white p-5 text-center">
            <p className="text-base font-semibold text-ink">Log in to Upaharo</p>
            <p className="mt-1 text-sm text-ink/55">See your orders, saved addresses and gift recipients.</p>
            <Link
              href="/login"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-wine px-8 text-sm font-semibold text-white transition hover:bg-wine-deep"
            >
              Log in
            </Link>
          </div>
        )}

        {user ? (
          <Section title="Shopping">
            <Row href="/orders" icon={ICONS.orders} title="My orders" subtitle="Track and reorder" />
            <Row href="/profile?tab=addresses" icon={ICONS.address} title="Saved addresses" subtitle="Where we deliver your gifts" />
            <Row href="/recipients" icon={ICONS.recipients} title="Gift recipients" subtitle="People you send gifts to" />
            <Row href="/favorites" icon={ICONS.favorites} title="Favorites" subtitle="Products you liked" />
          </Section>
        ) : null}

        {support.phone || support.email ? (
          <Section title="Help & support">
            {support.phone ? (
              <Row href={`tel:${support.phone.replace(/\s+/g, '')}`} icon={ICONS.phone} title="Call us" subtitle={[support.phone, support.hours].filter(Boolean).join(' · ')} />
            ) : null}
            {support.email ? (
              <Row href={`mailto:${support.email}`} icon={ICONS.email} title="Email us" subtitle={support.email} />
            ) : null}
          </Section>
        ) : null}

        <Section title="Legal">
          <Row href="/terms" icon={ICONS.terms} title="Terms of service" />
          <Row href="/privacy" icon={ICONS.privacy} title="Privacy policy" />
          {user ? <Row href="/account-deletion" icon={ICONS.remove} title="Delete account" /> : null}
        </Section>

        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-ink/10 bg-white text-[15px] font-semibold text-red-600 transition hover:bg-red-50"
          >
            Log out
          </button>
        ) : null}

        <p className="pb-2 text-center text-xs text-ink/40">Upaharo · Gifts delivered across Kathmandu Valley</p>
      </div>

      <BottomNav />
    </div>
  )
}
