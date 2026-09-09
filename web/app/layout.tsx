import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '45 920',
})

export const metadata: Metadata = {
  title: '작업 기록 — 클립 스튜디오',
  description:
    '클립 스튜디오 작업 시간을 주간·연간 그래프로 확인하세요.',
  icons: {
    icon: `${basePath}/icon.svg`,
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
      lang="ko"
      className={`${pretendard.variable} ${jetbrainsMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
