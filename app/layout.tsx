import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import { Providers } from './providers'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import AppDownloadReminder from '@/components/AppDownloadReminder'
import ChooseLocationPrompt from '@/components/ChooseLocationPrompt'
import OfflineIndicator from '@/components/OfflineIndicator'
import { SessionSync } from '@/components/SessionSync'
import RouteLoader from '@/components/RouteLoader'

function isLocalOrigin(value?: string | null) {
  if (!value) return false

  try {
    const hostname = new URL(value).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

const isProduction = process.env.NODE_ENV === 'production'
const metadataBaseUrl = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL

  if (isProduction && isLocalOrigin(configuredUrl)) {
    return undefined
  }

  return configuredUrl
})()

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-sans',
})

export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
    themeColor: '#ec4899',
  }
}

export const metadata: Metadata = {
  ...(metadataBaseUrl ? { metadataBase: new URL(metadataBaseUrl) } : {}),
  title: 'Upaharo - Gift & Flower Delivery | Same Day Delivery',
  description: 'Send flowers, cakes, and personalized gifts with same-day delivery. Express your love with Upaharo - Your trusted gift delivery partner.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Upaharo - Flowers & Gifts',
  },
  applicationName: 'Upaharo',
  keywords: ['flowers', 'gifts', 'cakes', 'delivery', 'same day delivery', 'birthday gifts', 'anniversary gifts'],
  authors: [{ name: 'Upaharo' }],
  creator: 'Upaharo',
  publisher: 'Upaharo',
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://www.upaharo.com',
    siteName: 'Upaharo',
    title: 'Upaharo - Gift & Flower Delivery',
    description: 'Send flowers, cakes, and gifts with same-day delivery',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Upaharo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Upaharo - Gift & Flower Delivery',
    description: 'Send flowers, cakes, and gifts with same-day delivery',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Upaharo" />
        <meta name="mobile-web-app-capable" content="yes" />
        {!isProduction && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) {
                      registration.unregister();
                    });
                  });
                }
                if ('caches' in window) {
                  caches.keys().then(function(keys) {
                    keys.forEach(function(key) {
                      if (
                        key.indexOf('workbox') !== -1 ||
                        key.indexOf('next-pwa') !== -1 ||
                        key.indexOf('next-data') !== -1 ||
                        key.indexOf('next-image') !== -1 ||
                        key.indexOf('static-') !== -1 ||
                        key === 'start-url' ||
                        key === 'apis' ||
                        key === 'others'
                      ) {
                        caches.delete(key);
                      }
                    });
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
        <Providers>
          <Suspense fallback={null}>
            <RouteLoader />
          </Suspense>
          <SessionSync />
          <OfflineIndicator />
          <PWAInstallPrompt />
          <ChooseLocationPrompt />
          <AppDownloadReminder />
          {children}
        </Providers>
      </body>
    </html>
  )
}
