import type { Metadata, Viewport } from 'next'
import { ThemeScript } from '@/components/ThemeScript'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bellbrief — your market brief, an hour before the bell',
  description:
    'One AI-summarised, source-cited news brief for the stocks and sectors you follow, delivered 60 minutes before your exchange opens, in your timezone.',
}

/**
 * Explicit rather than inherited: `maximumScale` is deliberately left alone so
 * the page stays pinch-zoomable, which capping it would break for anyone who
 * needs to magnify a citation.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-bb-bg text-bb-text antialiased">{children}</body>
    </html>
  )
}
