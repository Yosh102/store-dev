// app/layout.tsx
import type React from "react"
import { config } from "@fortawesome/fontawesome-svg-core"
import "@fortawesome/fontawesome-svg-core/styles.css"
import "./globals.css"
import type { Metadata } from "next"
import { Inter, Noto_Sans_JP } from "next/font/google"
import Script from "next/script"
import AuthProviderWrapper from "@/components/auth/AuthProviderWrapper"
import { CartProvider } from "@/lib/CartContext"
import ClientLayout from "./ClientLayout"
import { GoogleReCaptchaProvider } from '@/lib/recaptcha'
import ConditionalLayout from './ConditionalLayout'

const inter = Inter({ subsets: ["latin"] })
const notoSansJP = Noto_Sans_JP({ subsets: ["latin"] })

config.autoAddCss = false

export const metadata: Metadata = {
  title: "PLAY TUNE公式サイト",
  description:
    "2.9次元アイドル事務所「PLAY TUNE」の公式サイトです。最新情報やストア、ファンクラブなど限定コンテンツが盛りだくさん！",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-K9GYD1CEJ2"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-K9GYD1CEJ2');
          `}
        </Script>
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/apple-touch-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/apple-touch-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/apple-touch-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/apple-touch-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />
      </head>
      <body className={notoSansJP.className}>
        {/* リダイレクト復路ハンドラ：マウント時に一度だけ処理 */}
        <AuthProviderWrapper>
          <CartProvider>
            <ClientLayout>
              <GoogleReCaptchaProvider reCaptchaKey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''}>
                {/* パス別の条件付きレイアウト */}
                <ConditionalLayout>
                  {children}
                </ConditionalLayout>
              </GoogleReCaptchaProvider>
            </ClientLayout>
          </CartProvider>
        </AuthProviderWrapper>
      </body>
    </html>
  )
}
