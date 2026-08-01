import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { verifyBillAccessKey } from '@/lib/digital-bill'
import { formatPriceNoDecimals } from '@/lib/utils'

type PageProps = {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ k?: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orderNumber } = await params
  return {
    title: `Tax Invoice #${decodeURIComponent(orderNumber)}`,
    robots: { index: false, follow: false },
  }
}

function maskPhone(phone?: string | null) {
  const p = String(phone || '').replace(/\s+/g, '')
  if (p.length < 6) return p || '—'
  return `${p.slice(0, 2)}••••${p.slice(-3)}`
}

function money(n: number) {
  return formatPriceNoDecimals(Number(n) || 0)
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

export default async function DigitalBillPage({
  params,
  searchParams,
}: PageProps) {
  const { orderNumber: rawNumber } = await params
  const { k } = await searchParams
  const orderNumber = decodeURIComponent(rawNumber || '').trim()

  if (!orderNumber || !verifyBillAccessKey(orderNumber, k)) {
    notFound()
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      store: { select: { name: true, slug: true } },
      user: { select: { name: true, phone: true } },
      address: {
        select: {
          street: true,
          apartment: true,
          landmark: true,
          city: true,
          pincode: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              seller: {
                select: {
                  businessName: true,
                  businessAddress: true,
                  phone: true,
                  gstin: true,
                  panNumber: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!order) notFound()

  const isGrocery = order.store.slug === 'grocery'
  const accent = isGrocery ? '#0D9373' : '#6B1E3A'
  const accentSoft = isGrocery ? '#E6F7F2' : '#F8E9EF'
  const brand = isGrocery ? 'Grooll' : 'Upaharo'

  const placed = new Date(order.placedAt).toLocaleString('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  // Prefer first item's seller as invoice issuer (partner shop).
  const seller =
    order.items.find((it) => it.product.seller)?.product.seller ?? null
  const issuerName = seller?.businessName?.trim() || order.store.name
  const issuerAddress = seller?.businessAddress?.trim() || null
  const issuerPhone = seller?.phone?.trim() || null
  const issuerGstin = seller?.gstin?.trim() || null
  const issuerPan = seller?.panNumber?.trim() || null

  const addressLine = order.address
    ? [
        order.address.street,
        order.address.apartment,
        order.address.landmark,
        order.address.city,
        order.address.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : order.fulfillmentType === 'PICKUP'
      ? order.pickupAddress?.trim() || 'Store pickup'
      : '—'

  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0)

  return (
    <>
      <style>{`
        .inv-root {
          --accent: ${accent};
          --accent-soft: ${accentSoft};
          --ink: #0a2540;
          --muted: #697386;
          --charcoal: #425466;
          --line: #e3e8ee;
          --bg: #f6f9fc;
          --cream: #ffffff;
          min-height: 100vh;
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          background: var(--bg);
          color: var(--ink);
          -webkit-font-smoothing: antialiased;
        }
        .inv-wrap {
          max-width: 520px;
          margin: 0 auto;
          padding: 20px 14px 48px;
        }
        .inv-card {
          background: var(--cream);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
        }
        .inv-top {
          padding: 22px 20px 18px;
          border-bottom: 1px solid var(--line);
        }
        .inv-kicker {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0 0 6px;
        }
        .inv-title {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.4px;
          color: var(--ink);
        }
        .inv-sub {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--muted);
        }
        .inv-badge {
          display: inline-block;
          margin-top: 12px;
          padding: 4px 9px;
          border-radius: 6px;
          border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: -0.1px;
        }
        .inv-issuer {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 10px;
          background: var(--bg);
          border: 1px solid var(--line);
        }
        .inv-issuer-name {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.2px;
          margin: 0 0 4px;
        }
        .inv-issuer p {
          margin: 0;
          font-size: 12px;
          color: var(--charcoal);
          line-height: 1.45;
        }
        .inv-body { padding: 16px 20px 8px; }
        .inv-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 18px;
        }
        @media (max-width: 420px) {
          .inv-grid { grid-template-columns: 1fr; }
        }
        .inv-block h3 {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .inv-block p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--ink);
        }
        .inv-meta {
          display: grid;
          gap: 7px;
          font-size: 13px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid var(--line);
          border-radius: 10px;
        }
        .inv-meta div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }
        .inv-meta span { color: var(--muted); }
        .inv-meta strong {
          font-weight: 600;
          text-align: right;
          letter-spacing: -0.15px;
        }
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .inv-table th {
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--muted);
          padding: 0 0 8px;
          border-bottom: 1px solid var(--line);
        }
        .inv-table th.num,
        .inv-table td.num {
          text-align: right;
          white-space: nowrap;
        }
        .inv-table td {
          padding: 11px 0;
          border-bottom: 1px solid var(--line);
          vertical-align: top;
        }
        .inv-item-name {
          font-weight: 600;
          letter-spacing: -0.15px;
        }
        .inv-item-sku {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          font-weight: 400;
          color: var(--muted);
        }
        .inv-totals {
          margin-top: 8px;
          display: grid;
          gap: 7px;
          font-size: 13px;
          padding: 12px 0 4px;
        }
        .inv-totals div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: var(--charcoal);
        }
        .inv-grand {
          margin-top: 6px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.3px;
          color: var(--ink);
        }
        .inv-grand span:last-child { color: var(--accent); }
        .inv-actions {
          padding: 8px 20px 18px;
          display: flex;
          gap: 8px;
        }
        .inv-btn {
          flex: 1;
          appearance: none;
          border: 1px solid var(--line);
          background: var(--cream);
          color: var(--ink);
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.1px;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
        }
        .inv-btn-primary {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
        }
        .inv-foot {
          padding: 14px 20px 18px;
          border-top: 1px solid var(--line);
          background: var(--bg);
          text-align: center;
          font-size: 12px;
          color: var(--muted);
          line-height: 1.45;
        }
        .inv-powered {
          margin-top: 6px;
          font-size: 11px;
          color: var(--muted);
        }
        @media print {
          .inv-root { background: #fff; }
          .inv-wrap { padding: 0; max-width: none; }
          .inv-card { border: none; border-radius: 0; }
          .inv-actions { display: none !important; }
          .inv-foot { background: #fff; }
        }
      `}</style>

      <div className="inv-root">
        <main className="inv-wrap">
          <article className="inv-card">
            <header className="inv-top">
              <p className="inv-kicker">Tax invoice / bill</p>
              <h1 className="inv-title">#{order.orderNumber}</h1>
              <p className="inv-sub">
                {placed} · {itemCount} item{itemCount === 1 ? '' : 's'}
              </p>
              <div className="inv-badge">{statusLabel(order.status)}</div>

              <div className="inv-issuer">
                <p className="inv-issuer-name">{issuerName}</p>
                {issuerAddress ? <p>{issuerAddress}</p> : null}
                {issuerPhone ? <p>Phone: {issuerPhone}</p> : null}
                {issuerGstin ? <p>GSTIN: {issuerGstin}</p> : null}
                {issuerPan ? <p>PAN: {issuerPan}</p> : null}
                {!issuerGstin && !issuerPan ? (
                  <p>
                    Sold via {brand} ({order.store.name})
                  </p>
                ) : (
                  <p style={{ marginTop: 4 }}>via {brand}</p>
                )}
              </div>
            </header>

            <div className="inv-body">
              <div className="inv-grid">
                <div className="inv-block">
                  <h3>Bill to</h3>
                  <p>
                    <strong>{order.user.name || 'Customer'}</strong>
                    <br />
                    {maskPhone(order.user.phone)}
                  </p>
                </div>
                <div className="inv-block">
                  <h3>
                    {order.fulfillmentType === 'PICKUP'
                      ? 'Pickup'
                      : 'Deliver to'}
                  </h3>
                  <p>{addressLine}</p>
                </div>
              </div>

              <div className="inv-meta">
                <div>
                  <span>Invoice no.</span>
                  <strong>{order.orderNumber}</strong>
                </div>
                <div>
                  <span>Payment</span>
                  <strong>
                    {order.paymentMethod} · {order.paymentStatus}
                  </strong>
                </div>
                {order.deliverySlotLabel ? (
                  <div>
                    <span>Slot</span>
                    <strong>{order.deliverySlotLabel}</strong>
                  </div>
                ) : null}
              </div>

              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Rate</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => {
                    const line = it.quantity * it.price
                    const sku = it.product.sku?.trim()
                    return (
                      <tr key={it.id}>
                        <td>
                          <span className="inv-item-name">
                            {it.product.name}
                          </span>
                          {sku ? (
                            <span className="inv-item-sku">SKU {sku}</span>
                          ) : null}
                        </td>
                        <td className="num">{it.quantity}</td>
                        <td className="num">{money(it.price)}</td>
                        <td className="num">{money(line)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="inv-totals">
                <div>
                  <span>Subtotal</span>
                  <span>{money(order.subtotal)}</span>
                </div>
                {order.deliveryFee > 0 ? (
                  <div>
                    <span>Delivery fee</span>
                    <span>{money(order.deliveryFee)}</span>
                  </div>
                ) : null}
                {order.tax > 0 ? (
                  <div>
                    <span>Tax</span>
                    <span>{money(order.tax)}</span>
                  </div>
                ) : null}
                {order.discount > 0 ? (
                  <div>
                    <span>Discount</span>
                    <span>-{money(order.discount)}</span>
                  </div>
                ) : null}
                {order.couponDiscount > 0 ? (
                  <div>
                    <span>Coupon</span>
                    <span>-{money(order.couponDiscount)}</span>
                  </div>
                ) : null}
                {order.walletDiscount > 0 ? (
                  <div>
                    <span>Wallet</span>
                    <span>-{money(order.walletDiscount)}</span>
                  </div>
                ) : null}
                <div className="inv-grand">
                  <span>Total paid</span>
                  <span>{money(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="inv-actions">
              <a className="inv-btn inv-btn-primary" href="#print" id="inv-print">
                Print / save PDF
              </a>
            </div>

            <footer className="inv-foot">
              This is a computer-generated tax invoice for order #
              {order.orderNumber}. Scan the QR on your paper receipt anytime to
              reopen this bill.
              <div className="inv-powered">Powered by {brand}</div>
            </footer>
          </article>
        </main>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var btn = document.getElementById('inv-print');
              if (!btn) return;
              btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.print();
              });
            })();
          `,
        }}
      />
    </>
  )
}
