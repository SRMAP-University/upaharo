import type { ReactNode } from 'react'

/** Standalone digital invoice — no storefront chrome. */
export default function BillLayout({ children }: { children: ReactNode }) {
  return (
    <div data-digital-bill="1" style={{ minHeight: '100vh', background: '#f6f9fc' }}>
      {children}
    </div>
  )
}
