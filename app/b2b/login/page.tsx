'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import B2BHeader from '@/components/b2b/B2BHeader'
import { useB2BBusinessStore } from '@/lib/store/b2b-business'

function B2BLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/b2b'
  const setSession = useB2BBusinessStore((s) => s.setSession)
  const existing = useB2BBusinessStore((s) => s.session)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (existing?.token && existing.shopName) {
      router.replace(next)
    }
  }, [existing, next, router])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/b2b/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')

      setSession({
        token: data.token,
        user: data.user,
        shopName: data.shopName,
        address: data.address,
      })
      router.push(next)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8 pb-24">
      <p className="text-xs font-semibold uppercase tracking-wider text-wine/70">Business account</p>
      <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Business login</h1>
      <p className="mt-1 text-sm text-ink/50">Sign in with the email used for shop registration.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-2xl border border-wine/10 bg-white p-4">
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-ink/55">Email *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-wine/15 bg-[#F7F2EE]/50 px-3 py-2.5 text-sm outline-none focus:border-wine"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-ink/55">Password *</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-wine/15 bg-[#F7F2EE]/50 px-3 py-2.5 text-sm outline-none focus:border-wine"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-wine py-3 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink/50">
        New wholesale buyer?{' '}
        <Link href={`/b2b/register?next=${encodeURIComponent(next)}`} className="font-semibold text-wine">
          Register your shop
        </Link>
      </p>
    </main>
  )
}

export default function B2BLoginPage() {
  return (
    <>
      <B2BHeader />
      <Suspense fallback={<div className="p-10 text-center text-ink/40">Loading…</div>}>
        <B2BLoginForm />
      </Suspense>
    </>
  )
}
