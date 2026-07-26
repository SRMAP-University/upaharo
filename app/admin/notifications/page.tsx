'use client'

import { useCallback, useEffect, useState } from 'react'

type Audience = 'devices' | 'all' | 'email'
type NotifType = 'PROMO' | 'GENERAL'

interface Stats {
  customersWithDevices: number
  deviceTokens: number
  totalCustomers: number
}

interface RecentItem {
  id: string
  type: string
  title: string
  body: string
  createdAt: string
  user: { name: string; email: string }
}

export default function AdminNotificationsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Audience>('devices')
  const [email, setEmail] = useState('')
  const [type, setType] = useState<NotifType>('PROMO')
  const [deepLink, setDeepLink] = useState('/home')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setStats(data.stats)
      setRecent(data.recent || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          audience,
          email: audience === 'email' ? email.trim() : undefined,
          type,
          deepLink: deepLink.trim() || '/home',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Send failed')
      }
      const parts = [
        `Sent to ${data.recipients} user(s)`,
        `${data.devicesTargeted} device(s) targeted`,
        typeof data.pushDelivered === 'number' ? `${data.pushDelivered} FCM delivered` : null,
      ].filter(Boolean)
      setResult(parts.join(' · '))
      if (data.warning) {
        setError(data.warning)
      }
      setTitle('')
      setBody('')
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-ink/50">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Marketing push</h1>
        <p className="text-sm text-ink/50 mt-0.5">
          Send promos, offers, and announcements to the mobile app
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="App users" value={stats?.customersWithDevices ?? 0} hint="with device token" />
        <StatCard label="Devices" value={stats?.deviceTokens ?? 0} hint="FCM tokens" />
        <StatCard label="Customers" value={stats?.totalCustomers ?? 0} hint="all accounts" />
      </div>

      {(stats?.deviceTokens ?? 0) === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No phones registered yet. On the customer app: log in, allow notifications, then reopen the app.
          Refresh this page — <strong>Devices</strong> should be at least 1 before you send.
        </div>
      )}

      <form
        onSubmit={send}
        className="bg-white rounded-2xl border border-wine/10 p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as NotifType)}
              className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine"
            >
              <option value="PROMO">Marketing / promo</option>
              <option value="GENERAL">General announcement</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Audience</span>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as Audience)}
              className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine"
            >
              <option value="devices">Everyone with the app</option>
              <option value="all">All customers (inbox + push if installed)</option>
              <option value="email">Single user by email</option>
            </select>
          </label>
        </div>

        {audience === 'email' && (
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine"
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Title</span>
          <input
            required
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekend gift sale"
            className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">Message</span>
          <textarea
            required
            maxLength={200}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Get 15% off flowers & cakes this weekend. Tap to shop."
            className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine resize-none"
          />
          <span className="text-xs text-ink/40">{body.length}/200</span>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-ink/60 uppercase tracking-wide">
            Open in app (deep link)
          </span>
          <select
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
            className="w-full rounded-xl border border-wine/15 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-wine"
          >
            <option value="/home">Home</option>
            <option value="/main">Main / shop</option>
            <option value="/products">Products</option>
            <option value="/orders">Orders</option>
          </select>
        </label>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {result}
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !title.trim() || !body.trim()}
          className="w-full sm:w-auto rounded-xl bg-wine px-6 py-3 text-sm font-semibold text-white hover:bg-wine-deep disabled:opacity-50 transition-colors"
        >
          {sending ? 'Sending…' : 'Send push notification'}
        </button>
      </form>

      <section className="bg-white rounded-2xl border border-wine/10 overflow-hidden">
        <div className="px-4 py-4 border-b border-wine/10">
          <h2 className="font-medium text-ink">Recent marketing messages</h2>
          <p className="text-xs text-ink/45 mt-0.5">Latest inbox rows (one per recipient)</p>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-8 text-sm text-ink/45 text-center">No marketing pushes yet</p>
        ) : (
          <div className="divide-y divide-wine/10 max-h-[420px] overflow-y-auto">
            {recent.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                    <p className="text-xs text-ink/55 line-clamp-2 mt-0.5">{n.body}</p>
                    <p className="text-[11px] text-ink/40 mt-1 truncate">
                      → {n.user?.name || 'User'} ({n.user?.email})
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        n.type === 'PROMO'
                          ? 'bg-wine/10 text-wine'
                          : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {n.type}
                    </span>
                    <p className="text-[11px] text-ink/40 mt-1">
                      {new Date(n.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-wine/10 bg-white px-4 py-3">
      <p className="text-xs text-ink/45">{label}</p>
      <p className="text-2xl font-semibold text-ink mt-0.5">{value}</p>
      <p className="text-[11px] text-ink/35">{hint}</p>
    </div>
  )
}
