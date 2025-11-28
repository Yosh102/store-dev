"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X, User, LogOut, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/lib/CartContext"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Group } from "@/types/group"

interface GroupNavbarProps {
  group: Group
  slug: string
}

const GroupNavbar: React.FC<GroupNavbarProps> = ({ group, slug }) => {
  const { user } = useAuth()
  const { getItemCount } = useCart()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  
  // カート内アイテム数を取得
  const cartItemCount = getItemCount()
  
  // 現在のページがグループのトップページかどうかを判定（pathnameを使用）
  const isGroupTopPage = pathname === `/group/${slug}`

  // 現在のページがグループページ関連かどうかを判定
  const isGroupStorePage = pathname === `/group/${slug}/store` || pathname.startsWith(`/group/${slug}/store/`)
  const isGroupPage = pathname.startsWith(`/group/${slug}`)

  // リダイレクト用のURL生成
  const getRedirectUrl = () => {
    if (typeof window !== 'undefined') {
      return encodeURIComponent(window.location.pathname + window.location.search)
    }
    return encodeURIComponent(`/group/${slug}`)
  }

  // カートへのリンクURL生成（グループページからの遷移情報を含む）
  const getCartUrl = () => {
    if (isGroupStorePage) {
      return `/cart?from=group-store&groupSlug=${slug}`
    } else if (isGroupPage) {
      return `/cart?from=group&groupSlug=${slug}`
    }
    return '/cart'
  }

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || null)
    } else {
      setAvatarUrl(null)
    }
  }, [user])

  // スクロール監視の効果をパス変更で即座にリセット
  useEffect(() => {
    if (!isGroupTopPage) {
      // トップページ以外では常に背景ありの状態
      setIsScrolled(true)
      return
    }

    // トップページの場合のスクロール監視
    const handleScroll = () => {
      // Heroセクションの高さを取得（通常60vh程度）
      const heroHeight = window.innerHeight * 0.6; // 60vhと仮定
      const scrollY = window.scrollY;
      
      // Heroセクションを過ぎたら背景を黒にする
      setIsScrolled(scrollY > heroHeight - 100); // 100px手前から変化開始
    };

    // 初期状態をチェック（即座に実行）
    handleScroll();

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isGroupTopPage, pathname]) // pathnameを依存配列に追加

  // ページ変更時にメニューを閉じる
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      setIsMenuOpen(false)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  // グループのロゴ画像URL解決
  const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  // ユーザーの状態を判定
  const isSubscribed = group?.id && user?.subscriptions?.[group.id] 
    ? user.subscriptions[group.id].status === "active" 
    : false

  const handleJoinClick = () => {
    // トップページ以外の場合はトップページに遷移してからスクロール
    if (!isGroupTopPage) {
      window.location.href = `/group/${slug}#join-section`
      return
    }
    
    const joinSection = document.getElementById('join-section')
    if (joinSection) {
      joinSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const menuItems = [
    { label: "NEWS", href: `/group/${slug}/news` },
    { label: "PROFILE", href: `/group/${slug}/profile` },
    { label: "DISCOGRAPHY", href: `/group/${slug}/discography` },
    { label: "GOODS", href: `/group/${slug}/store` },
    { label: "CONTENT", href: `/group/${slug}/posts` },
    { label: "STAFF DIARY", href: `/group/${slug}/staff` },
    { label: "MY PAGE", href: `/group/${slug}/mypage` },
  ]

  return (
    <>
      {/* Desktop Navigation */}
      <header className={`group-navbar fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        isScrolled || !isGroupTopPage
          ? 'bg-black/95 backdrop-blur-md shadow-lg' 
          : 'bg-transparent backdrop-blur-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href={`/group/${slug}`} className="flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image
                    src={resolveImageUrl(group.logoUrl || group.coverImage)}
                    alt={group.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-white font-bold text-lg tracking-wider">
                  {group.name.toUpperCase()}
                </span>
              </div>
            </Link>

            {/* Right Side - 位置固定のため常に同じ幅を保持 */}
            <div className="flex items-center space-x-4">
              {/* LOGIN/JOIN/MY PAGE ボタン - 常に表示して位置を固定 */}
              <div className="hidden md:flex">
                {!user ? (
                  <div className="flex items-center space-x-4 text-white font-bold tracking-wider">
                    <button 
                      onClick={handleJoinClick}
                      className="hover:text-gray-300 transition-colors"
                    >
                      JOIN
                    </button>
                    <span className="text-white/50">/</span>
                    <Link 
                      href={`/login?redirect=${getRedirectUrl()}`} 
                      className="hover:text-gray-300 transition-colors"
                    >
                      LOGIN
                    </Link>
                  </div>
                ) : isSubscribed ? (
                  <Link 
                    href={`/group/${slug}/mypage`}
                    className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                  >
                    MY PAGE
                  </Link>
                ) : (
                  <button 
                    onClick={handleJoinClick}
                    className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                  >
                    JOIN
                  </button>
                )}
              </div>

              {/* Cart Icon with Group Store Redirect */}
              <Link href={getCartUrl()} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 relative"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-[20px]"
                    >
                      {cartItemCount > 99 ? '99+' : cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              
              {/* Mobile Menu Button - 位置固定 */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white relative"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  {/* ハンバーガー/バツのアニメーション */}
                  <div className="w-6 h-6 flex flex-col justify-center items-center">
                    <span 
                      className={`bg-white block h-0.5 w-6 rounded-sm transition-all duration-300 ease-out ${
                        isMenuOpen ? 'rotate-45 translate-y-1' : '-translate-y-0.5'
                      }`}
                    ></span>
                    <span 
                      className={`bg-white block h-0.5 w-6 rounded-sm my-0.5 transition-all duration-300 ease-out ${
                        isMenuOpen ? 'opacity-0' : 'opacity-100'
                      }`}
                    ></span>
                    <span 
                      className={`bg-white block h-0.5 w-6 rounded-sm transition-all duration-300 ease-out ${
                        isMenuOpen ? '-rotate-45 -translate-y-1' : 'translate-y-0.5'
                      }`}
                    ></span>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Fullscreen Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black z-50 flex animate-fade-in">
          {/* ナビバーと同じ構造を維持 */}
          <div className="absolute top-0 left-0 right-0 z-60">
            <div className="max-w-7xl mx-auto px-6">
              <div className="h-16 flex items-center justify-between">
                {/* Logo - 同じ位置 */}
                <Link href={`/group/${slug}`} onClick={() => setIsMenuOpen(false)} className="flex-shrink-0">
                  <div className="flex items-center space-x-3 animate-slide-in-left">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <Image
                        src={resolveImageUrl(group.logoUrl || group.coverImage)}
                        alt={group.name}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-white font-bold text-lg tracking-wider">
                      {group.name.toUpperCase()}
                    </span>
                  </div>
                </Link>

                {/* Right Side - 同じ構造 */}
                <div className="flex items-center space-x-4">
                  {/* LOGIN/JOIN/MY PAGE ボタン - 同じ位置 */}
                  <div className="hidden md:flex animate-slide-in-right" style={{ animationDelay: '200ms' }}>
                    {!user ? (
                      <div className="flex items-center space-x-4 text-white font-bold tracking-wider">
                        <button 
                          onClick={() => {
                            handleJoinClick()
                            setIsMenuOpen(false)
                          }}
                          className="hover:text-gray-300 transition-colors"
                        >
                          JOIN
                        </button>
                        <span className="text-white/50">/</span>
                        <Link 
                          href={`/login?redirect=${getRedirectUrl()}`} 
                          onClick={() => setIsMenuOpen(false)} 
                          className="hover:text-gray-300 transition-colors"
                        >
                          LOGIN
                        </Link>
                      </div>
                    ) : isSubscribed ? (
                      <Link 
                        href={`/group/${slug}/mypage`}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                      >
                        MY PAGE
                      </Link>
                    ) : (
                      <button 
                        onClick={() => {
                          handleJoinClick()
                          setIsMenuOpen(false)
                        }}
                        className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                      >
                        JOIN
                      </button>
                    )}
                  </div>

                  {/* Mobile版 LOGIN/JOIN - モバイルのみ表示 */}
                  <div className="md:hidden animate-slide-in-right" style={{ animationDelay: '200ms' }}>
                    {!user ? (
                      <div className="flex items-center space-x-4 text-white font-bold tracking-wider">
                        <button 
                          onClick={() => {
                            handleJoinClick()
                            setIsMenuOpen(false)
                          }}
                          className="hover:text-gray-300 transition-colors"
                        >
                          JOIN
                        </button>
                        <span className="text-white/50">/</span>
                        <Link 
                          href={`/login?redirect=${getRedirectUrl()}`} 
                          onClick={() => setIsMenuOpen(false)} 
                          className="hover:text-gray-300 transition-colors"
                        >
                          LOGIN
                        </Link>
                      </div>
                    ) : isSubscribed ? (
                      <Link 
                        href={`/group/${slug}/mypage`}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                      >
                        MY PAGE
                      </Link>
                    ) : (
                      <button 
                        onClick={() => {
                          handleJoinClick()
                          setIsMenuOpen(false)
                        }}
                        className="text-white font-bold tracking-wider hover:text-gray-300 transition-colors"
                      >
                        JOIN
                      </button>
                    )}
                  </div>

                  {/* Cart Icon - Mobile Menu でも適切なリダイレクト */}
                  <Link href={getCartUrl()} className="relative" onClick={() => setIsMenuOpen(false)}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/10 relative"
                    >
                      <ShoppingCart className="h-5 w-5" />
                      {cartItemCount > 0 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-[20px]"
                        >
                          {cartItemCount > 99 ? '99+' : cartItemCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                  
                  {/* ×ボタン - ハンバーガーと同じ位置 */}
                  <div className="relative">
                    {/* 透明なボタンでスペースを確保し、×を表示 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white relative hover:bg-white/10"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <div className="w-6 h-6 flex flex-col justify-center items-center">
                        <span className="bg-white block h-0.5 w-6 rounded-sm rotate-45 translate-y-1"></span>
                        <span className="bg-white block h-0.5 w-6 rounded-sm my-0.5 opacity-0"></span>
                        <span className="bg-white block h-0.5 w-6 rounded-sm -rotate-45 -translate-y-1"></span>
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items - レスポンシブ対応 */}
          <div className="absolute inset-0 pt-16">
            {/* デスクトップ: 2列レイアウト */}
            <div className="hidden md:flex h-full items-center">
              {/* 左右の列を中央に配置するためのコンテナ */}
              <div className="w-full flex">
                {/* Left Column */}
                <div className="flex-1 flex flex-col items-start pl-16">
                  <div className="flex flex-col space-y-8">
                    {menuItems.slice(0, 4).map((item, index) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-white text-4xl md:text-6xl font-bold tracking-wider hover:text-gray-300 transition-colors opacity-0 animate-slide-in-up"
                        style={{ 
                          animationDelay: `${400 + index * 100}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Right Column */}
                <div className="flex-1 flex flex-col items-start pl-16">
                  <div className="flex flex-col space-y-8">
                    {menuItems.slice(4).map((item, index) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className="text-white text-4xl md:text-6xl font-bold tracking-wider hover:text-gray-300 transition-colors opacity-0 animate-slide-in-up"
                        style={{ 
                          animationDelay: `${800 + index * 100}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* モバイル: 1列レイアウト */}
            <div className="md:hidden flex flex-col justify-center items-center space-y-6 px-8 h-full">
              {menuItems.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-white text-3xl font-bold tracking-wider hover:text-gray-300 transition-colors opacity-0 animate-slide-in-up text-center"
                  style={{ 
                    animationDelay: `${400 + index * 100}ms`,
                    animationFillMode: 'forwards'
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* User info in mobile menu */}
          {user && (
            <div className="absolute bottom-8 left-8 md:left-16 animate-slide-in-bottom">
              <div className="flex items-center space-x-3 text-white">
                <Avatar className="h-8 w-8">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={user?.displayName || "User avatar"} />
                  ) : (
                    <AvatarFallback className="bg-gray-600 text-white">
                      {getInitials(user?.displayName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm">{user.displayName || 'ユーザー'}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default GroupNavbar