import { redirect, notFound } from 'next/navigation'
import { verifyBillAccessKey } from '@/lib/digital-bill'

type PageProps = {
  params: Promise<{ orderNumber: string; key: string }>
}

/** Short QR URL → full digital bill page. */
export default async function ShortDigitalBillPage({ params }: PageProps) {
  const { orderNumber: rawNumber, key } = await params
  const orderNumber = decodeURIComponent(rawNumber || '').trim()
  if (!orderNumber || !verifyBillAccessKey(orderNumber, key)) {
    notFound()
  }
  redirect(`/bill/${encodeURIComponent(orderNumber)}?k=${encodeURIComponent(key)}`)
}
