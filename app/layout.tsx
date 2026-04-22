import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/nav'

export const metadata: Metadata = {
  title: 'SEO Audit Ticketing',
  description: 'Internal SEO audit ticket management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
