'use client'

import { useEffect, useState } from 'react'

type Setup = { via: 'brevo-api' | 'smtp' | 'none'; sender: string; smtpHost: string | null }

const VIA_LABEL: Record<Setup['via'], string> = {
  'brevo-api': 'Brevo (API key)',
  smtp: 'SMTP',
  none: 'Not set up',
}

/** Settings → Email: shows how the website sends email and sends a test. */
export default function EmailTestCard() {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/email/test', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setSetup(data))
      .catch(() => undefined)
  }, [])

  const send = async () => {
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      setResult(
        data?.ok
          ? { ok: true, text: `Sent to ${data.to}. Check the inbox (and spam).` }
          : { ok: false, text: data?.error || `Failed (${res.status})` }
      )
    } catch {
      setResult({ ok: false, text: 'Could not reach the server.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-base font-semibold text-ink">Email</h2>
        {setup ? (
          <p className="text-xs text-ink/55">
            Sending with <span className="font-semibold text-ink">{VIA_LABEL[setup.via]}</span>
            {setup.smtpHost && setup.via === 'smtp' ? ` (${setup.smtpHost})` : ''} from{' '}
            <span className="font-semibold text-ink">{setup.sender}</span>
          </p>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-ink/55">
        Seller login details and admin notices go by email. Send a test to check it works; if it fails, the reason is shown here.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Your admin email (leave empty) or another address"
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm sm:max-w-sm"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="rounded-xl bg-wine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send test email'}
        </button>
      </div>
      {result ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {result.text}
        </p>
      ) : null}
    </div>
  )
}
