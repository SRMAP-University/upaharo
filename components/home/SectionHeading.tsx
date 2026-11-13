import Link from 'next/link'

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  description?: string
  href?: string
  ctaLabel?: string
  align?: 'left' | 'center'
}

export default function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  ctaLabel = 'View all',
  align = 'left',
}: SectionHeadingProps) {
  const isCenter = align === 'center'

  return (
    <div
      className={`flex flex-row items-start justify-between gap-3 sm:items-end ${
        isCenter ? 'sm:flex-col sm:items-center sm:text-center' : ''
      }`}
    >
      <div className={isCenter ? 'mx-auto max-w-xl' : ''}>
        {/* Studio keeps headings plain: the eyebrow is not shown. */}
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink sm:text-[28px]" data-eyebrow={eyebrow || undefined}>
          {title}
        </h2>
        {description ? <p className="mt-1 text-[13px] text-ink/50 sm:text-sm">{description}</p> : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="group inline-flex flex-shrink-0 items-center gap-0.5 self-start whitespace-nowrap py-1.5 text-[13px] font-bold text-brand transition hover:text-brand-dark sm:self-auto sm:text-sm"
        >
          {ctaLabel}
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
          </svg>
        </Link>
      ) : null}
    </div>
  )
}
