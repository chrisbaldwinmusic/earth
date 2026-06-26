import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Earth',
  description: 'Interactive globe music events map',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
