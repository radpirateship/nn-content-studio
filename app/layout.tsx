import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { AriaLiveProvider } from '@/components/aria-live-announcer'
import './globals.css'

export const metadata: Metadata = {
  title: 'NN Content Studio | Naked Nutrition',
  description: 'AI-powered content automation for supplement articles',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&family=Open+Sans:wght@300..800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="font-sans antialiased"
        style={{ fontFamily: "'Open Sans', system-ui, sans-serif" }}
        suppressHydrationWarning
      >
        {/* Skip to content link for keyboard / screen reader accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none"
          style={{ background: 'var(--nn-accent, #00A3FF)' }}
        >
          Skip to content
        </a>
        <AriaLiveProvider>
          {children}
        </AriaLiveProvider>
        <Toaster position="bottom-right" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
