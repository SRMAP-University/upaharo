'use client'

import { instagramOrderUrl, whatsAppOrderUrl } from '@/lib/social-order-links'
import { useStoreContact } from '@/lib/use-store-contact'

type ProductSocialOrderButtonsProps = {
  product: { id: string; name: string; price: number }
  quantity?: number
  variant?: 'compact' | 'full'
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.28-.14-1.64-.81-1.9-.9-.25-.1-.44-.14-.62.14-.18.28-.71.9-.87 1.08-.16.18-.32.2-.6.07-.28-.14-1.17-.43-2.23-1.37-.82-.73-1.38-1.64-1.54-1.91-.16-.28-.02-.43.12-.57.13-.12.28-.32.42-.48.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47h-.53c-.18 0-.48.07-.73.35-.25.28-.96.94-.96 2.3 0 1.35.98 2.66 1.12 2.84.14.18 1.93 2.95 4.67 4.14.65.28 1.16.45 1.56.57.65.21 1.25.18 1.72.11.52-.08 1.64-.67 1.87-1.32.23-.65.23-1.2.16-1.32-.07-.11-.25-.18-.53-.32z" />
      <path d="M12.04 2C6.5 2 2 6.42 2 11.88c0 1.75.46 3.45 1.34 4.95L2 22l5.3-1.39c1.45.79 3.08 1.21 4.74 1.21h.01c5.54 0 10.04-4.42 10.04-9.88C22.09 6.42 17.58 2 12.04 2zm0 17.93h-.01c-1.5 0-2.97-.4-4.25-1.15l-.3-.18-3.15.82.84-3.07-.2-.32A8.1 8.1 0 0 1 3.9 11.9c0-4.47 3.7-8.1 8.14-8.1 4.45 0 8.14 3.63 8.14 8.1 0 4.47-3.7 8.03-8.14 8.03z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  )
}

export default function ProductSocialOrderButtons({
  product,
  quantity = 1,
  variant = 'compact',
}: ProductSocialOrderButtonsProps) {
  const contact = useStoreContact()
  const whatsappHref = whatsAppOrderUrl(contact.phone, product, quantity)
  const instagramHref = instagramOrderUrl(contact.instagram)

  if (!whatsappHref && !instagramHref) return null

  const compact = variant === 'compact'
  const itemClass = compact
    ? 'inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.04em] text-white transition hover:opacity-90 active:scale-95'
    : 'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]'
  const iconClass = compact ? 'h-3.5 w-3.5' : 'h-5 w-5'

  return (
    <div
      className={compact ? 'mt-2 flex gap-1.5' : 'flex gap-2'}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${itemClass} bg-[#25D366]`}
          aria-label={`Order ${product.name} on WhatsApp`}
        >
          <WhatsAppIcon className={iconClass} />
          {compact ? 'WhatsApp' : 'Order on WhatsApp'}
        </a>
      ) : null}
      {instagramHref ? (
        <a
          href={instagramHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${itemClass} bg-[linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)]`}
          aria-label={`Order ${product.name} on Instagram`}
        >
          <InstagramIcon className={iconClass} />
          {compact ? 'Instagram' : 'Order on Instagram'}
        </a>
      ) : null}
    </div>
  )
}
