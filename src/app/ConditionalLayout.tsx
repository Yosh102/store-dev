"use client"

import { usePathname } from 'next/navigation'
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()

  // /group/[slug]
  const isGroupSlugPage = pathname.startsWith('/group/') && pathname !== '/group'

  // ✅ ログイン系
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/verify-email'

  // ✅ Navbar / Footer を消すページ
  const useIndependentLayout = isGroupSlugPage || isAuthPage

  if (useIndependentLayout) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    )
  }

  // 通常レイアウト
  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 pt-14">{children}</div>
      <Footer />
    </main>
  )
}
