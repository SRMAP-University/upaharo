import Link from 'next/link'
import type { ReactNode } from 'react'

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF0F4] via-[#F7F2EE] to-[#F7F2EE]">
      <header className="border-b border-wine/10 bg-[#F7F2EE]/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-display text-xl font-semibold text-wine">
            Upaharo
          </Link>
          <Link href="/" className="text-sm font-semibold text-wine/70 hover:text-wine">
            Back to shop
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wine/60">Legal</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ink md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-ink/45">Last updated: {updated}</p>

        <article className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-ink/80">
          {children}
        </article>

        <nav className="mt-12 flex flex-wrap gap-4 border-t border-wine/10 pt-6 text-sm font-semibold text-wine">
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <Link href="/account-deletion" className="hover:underline">
            Account deletion
          </Link>
        </nav>
      </main>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
