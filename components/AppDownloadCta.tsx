import { PLAY_STORE_APP_URL } from '@/lib/app-download'

type AppDownloadCtaProps = {
  title?: string
  description?: string
  compact?: boolean
}

export default function AppDownloadCta({
  title = 'Get the Upaharo app',
  description = 'Faster checkout, order tracking, and daily Spin & Win rewards.',
  compact = false,
}: AppDownloadCtaProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border border-blush/20 bg-gradient-to-r from-blush-soft via-white to-cream ${
        compact
          ? 'rounded-2xl px-4 py-3'
          : 'rounded-[24px] px-5 py-5 lg:rounded-[28px] lg:px-6'
      }`}
    >
      <div className="min-w-0">
        <p className={`font-extrabold text-ink ${compact ? 'text-sm' : 'text-base lg:text-lg'}`}>
          {title}
        </p>
        <p className={`mt-0.5 text-ink/55 ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
      </div>
      <a
        href={PLAY_STORE_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-wine lg:px-5 lg:text-sm"
      >
        Get the app
      </a>
    </div>
  )
}
