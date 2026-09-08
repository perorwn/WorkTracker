import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'Canvas — Clip Studio Paint Time Tracker',
  description:
    'A minimalist personal dashboard tracking your Clip Studio Paint working hours across the week.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: `${basePath}/icon-light-32x32.png`,
        media: '(prefers-color-scheme: light)',
      },
      {
        url: `${basePath}/icon-dark-32x32.png`,
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: `${basePath}/icon.svg`,
        type: 'image/svg+xml',
      },
    ],
    apple: `${basePath}/apple-icon.png`,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
