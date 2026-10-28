import type { ReactNode } from 'react'

type IconProps = { className?: string }

function Icon({ className, d }: IconProps & { d: string | string[] }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" aria-hidden>
      {(Array.isArray(d) ? d : [d]).map((path) => (
        <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />
      ))}
    </svg>
  )
}

export const AdminIcons = {
  Dashboard: (p: IconProps) => (
    <Icon {...p} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  ),
  Orders: (p: IconProps) => (
    <Icon {...p} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  ),
  Receipt: (p: IconProps) => (
    <Icon {...p} d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  ),
  Ticket: (p: IconProps) => (
    <Icon {...p} d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  ),
  Gift: (p: IconProps) => (
    <Icon {...p} d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 19.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  ),
  Folder: (p: IconProps) => (
    <Icon {...p} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  ),
  Sparkles: (p: IconProps) => (
    <Icon {...p} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  ),
  Ribbon: (p: IconProps) => (
    <Icon {...p} d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
  ),
  Image: (p: IconProps) => (
    <Icon {...p} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12a2.25 2.25 0 002.25 2.25zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  ),
  Rectangles: (p: IconProps) => (
    <Icon {...p} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  ),
  Phone: (p: IconProps) => (
    <Icon {...p} d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  ),
  Megaphone: (p: IconProps) => (
    <Icon {...p} d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
  ),
  Users: (p: IconProps) => (
    <Icon {...p} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  ),
  Store: (p: IconProps) => (
    <Icon {...p} d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
  ),
  Key: (p: IconProps) => (
    <Icon {...p} d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
  ),
  Cog: (p: IconProps) => (
    <Icon
      {...p}
      d={[
        'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.87l-.212 1.281c-.09.542-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.53 6.53 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.298-2.247a1.125 1.125 0 011.369-.491l1.217.456c.355.133.75.072 1.076-.124.074-.044.147-.087.22-.128.332-.183.582-.495.644-.87l.212-1.28z',
        'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      ]}
    />
  ),
  Search: (p: IconProps) => <Icon {...p} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />,
  Menu: (p: IconProps) => <Icon {...p} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />,
  Close: (p: IconProps) => <Icon {...p} d="M6 18L18 6M6 6l12 12" />,
  Plus: (p: IconProps) => <Icon {...p} d="M12 4.5v15m7.5-7.5h-15" />,
  External: (p: IconProps) => (
    <Icon {...p} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
  ),
  Logout: (p: IconProps) => (
    <Icon {...p} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  ),
  ChevronsLeft: (p: IconProps) => <Icon {...p} d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />,
  ChevronsRight: (p: IconProps) => <Icon {...p} d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />,
  ChevronRight: (p: IconProps) => <Icon {...p} d="M8.25 4.5l7.5 7.5-7.5 7.5" />,
  ChevronDown: (p: IconProps) => <Icon {...p} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />,
}

export type AdminNavItem = {
  label: string
  /** Shorter name for the phone tab bar. */
  shortLabel?: string
  href: string
  icon: (props: IconProps) => ReactNode
  /** Extra words the search box matches. */
  keywords?: string
}

export type AdminNavGroup = { label: string; items: AdminNavItem[] }

/** The admin menu, grouped by the job each page does. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', shortLabel: 'Home', href: '/admin', icon: AdminIcons.Dashboard, keywords: 'home stats sales' }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', href: '/admin/orders', icon: AdminIcons.Orders, keywords: 'deliveries customers' },
      { label: 'Offline order', href: '/admin/orders/offline', icon: AdminIcons.Receipt, keywords: 'phone walk-in manual new order pos' },
      { label: 'Coupons', href: '/admin/coupons', icon: AdminIcons.Ticket, keywords: 'discount codes promo' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', href: '/admin/products', icon: AdminIcons.Gift, keywords: 'items inventory stock price' },
      { label: 'Categories', href: '/admin/categories', icon: AdminIcons.Folder, keywords: 'collections' },
      { label: 'Occasions', href: '/admin/occasions', icon: AdminIcons.Sparkles, keywords: 'birthday anniversary festival' },
      { label: 'Gift wraps', href: '/admin/gift-wraps', icon: AdminIcons.Ribbon, keywords: 'packaging wrapping' },
    ],
  },
  {
    label: 'Storefront',
    items: [
      { label: 'Banners', href: '/admin/banners', icon: AdminIcons.Image, keywords: 'carousel hero slides home' },
      { label: 'Mini banners', href: '/admin/mini-banners', icon: AdminIcons.Rectangles, keywords: 'strip promo' },
      { label: 'App features', shortLabel: 'Features', href: '/admin/features', icon: AdminIcons.Phone, keywords: 'mobile app screens' },
    ],
  },
  {
    label: 'Marketing',
    items: [{ label: 'Push notifications', shortLabel: 'Push', href: '/admin/notifications', icon: AdminIcons.Megaphone, keywords: 'marketing message campaign' }],
  },
  {
    label: 'People',
    items: [
      { label: 'Customers', href: '/admin/users', icon: AdminIcons.Users, keywords: 'users accounts wallet' },
      { label: 'Sellers', href: '/admin/sellers', icon: AdminIcons.Store, keywords: 'vendors merchants' },
      { label: 'Partner access', shortLabel: 'Partners', href: '/admin/partners', icon: AdminIcons.Key, keywords: 'delivery riders merchant login' },
    ],
  },
  {
    label: 'Setup',
    items: [{ label: 'Settings', href: '/admin/settings', icon: AdminIcons.Cog, keywords: 'theme delivery zones slots payment store' }],
  },
]

export const ADMIN_NAV_ITEMS = ADMIN_NAV.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))

/** Shortcuts the search box offers besides the pages themselves. */
export const ADMIN_QUICK_ACTIONS: Array<{ label: string; href: string; keywords?: string }> = [
  { label: 'Add a product', href: '/admin/products/new', keywords: 'new create item' },
  { label: 'Create an offline order', href: '/admin/orders/offline', keywords: 'new phone walk-in' },
  { label: 'Create a coupon', href: '/admin/coupons', keywords: 'new discount code' },
  { label: 'Send a push notification', href: '/admin/notifications', keywords: 'new message marketing' },
]

/** The menu item a path belongs to (longest matching link wins, so /admin/orders/offline is not Orders). */
export function adminNavItemFor(pathname: string) {
  let best: (typeof ADMIN_NAV_ITEMS)[number] | undefined
  for (const item of ADMIN_NAV_ITEMS) {
    const matches = item.href === '/admin' ? pathname === '/admin' : pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (matches && (!best || item.href.length > best.href.length)) best = item
  }
  return best
}

/** Breadcrumb trail for the top bar, e.g. Catalog › Products › Edit product. */
export function adminBreadcrumbs(pathname: string): string[] {
  const item = adminNavItemFor(pathname)
  if (!item) return ['Admin']
  const trail = item.href === '/admin' ? [item.label] : [item.group, item.label]
  if (item.href === '/admin/products' && pathname !== item.href) {
    trail.push(pathname.endsWith('/new') ? 'New product' : 'Edit product')
  }
  return trail
}
