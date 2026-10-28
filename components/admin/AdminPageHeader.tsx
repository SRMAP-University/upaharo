import Link from 'next/link'
import type { ReactNode } from 'react'

/** Button styles shared by admin page headers. */
export const adminButtonClass = {
  primary:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-wine px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-wine-deep disabled:opacity-50',
  secondary:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-sm font-medium text-ink/80 transition-colors hover:border-stone-300 hover:text-ink disabled:opacity-50',
}

/**
 * Title row for an admin page: heading, one-line description and the page's
 * main actions. On phones the top bar already shows the title, so only the
 * description and actions show here.
 */
export default function AdminPageHeader({
  title,
  description,
  actions,
  back,
  showTitleOnMobile = false,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
  showTitleOnMobile?: boolean
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-sm font-medium text-ink/55 hover:text-wine">
            <span aria-hidden>←</span> {back.label}
          </Link>
        ) : null}
        <h2
          className={`${showTitleOnMobile ? 'block' : 'hidden md:block'} text-2xl font-semibold tracking-tight text-ink`}
        >
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-ink/55">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
