"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ShoppingCart, LogOut, CreditCard, User, Menu, X, ChevronDown, ChevronUp, Lock, MapPin, Calendar, Package, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useCart } from "@/lib/CartContext"
import { useAuth } from "@/context/auth-context"
import { auth } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type React from "react"

const Navbar: React.FC = () => {
  const { user } = useAuth()
  const { items } = useCart()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl || null)
    } else {
      setAvatarUrl(null)
    }
  }, [user])

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-300 shadow-sm">
      <div className="max-w-[1320px] mx-auto px-5">
        <div className="h-16 flex items-center justify-between">
          {/* Logo - 画質向上のために修正 */}

          <Link href="/" className="flex-shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-auto h-7">
                  <Image
                    src={"/logo.png"}
                    alt="オーディション事務局"
                    width={200}
                    height={120}
                    quality={100}
                    priority
                  />
                </div>
              </div>
            </Link>
          
          {/* Cart and User Menu */}
          <div className="flex items-center space-x-4">
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                <ShoppingCart className="h-4 w-4" />
                {items.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {items.length}
                  </span>
                )}
              </Button>
            </Link>
            {user ? (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Avatar className="h-8 w-8">
                        {avatarUrl ? (
                          <AvatarImage src={avatarUrl} alt={user?.displayName || "User avatar"} />
                        ) : (
                          <AvatarFallback className="bg-gray-200">{getInitials(user?.displayName)}</AvatarFallback>
                        )}
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.displayName || 'ユーザー'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email || ''}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="flex items-center">
                          <User className="mr-2 h-4 w-4" />
                          プロフィール
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/change-password" className="flex items-center">
                          <Lock className="mr-2 h-4 w-4" />
                          パスワード変更
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/address" className="flex items-center">
                          <MapPin className="mr-2 h-4 w-4" />
                          住所管理
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem asChild>
                        <Link href="/subscription" className="flex items-center">
                          <Calendar className="mr-2 h-4 w-4" />
                          サブスクリプション管理
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/orders" className="flex items-center">
                          <Package className="mr-2 h-4 w-4" />
                          注文履歴
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/wallet" className="flex items-center">
                          <CreditCard className="mr-2 h-4 w-4" />
                          ウォレット
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      サインアウト
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden md:block">
                <Link href="/login">
                  <Button
                    variant="secondary"
                    className="h-8 px-3 py-0 text-bold"
                  >
                    ログインまたは会員登録
                  </Button>
                </Link>
              </div>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(true)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu - アコーディオンスタイルのメニュー */}
        {isMenuOpen && (
          <div className="fixed inset-0 bg-white z-50 md:hidden overflow-y-auto animate-fadeIn">
            <div className="p-5">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4"
                onClick={() => setIsMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </Button>
              <div className="mt-16 space-y-3">
                {[
                  { label: "ホーム", href: "/" },
                  { label: "タレント", href: "/group" },
                  { label: "ストア", href: "/store" },
                  { label: "ファンクラブ", href: "/membership" },
                ].map((item) => (
                  <Link key={item.label} href={item.href} onClick={() => setIsMenuOpen(false)}>
                    <Button variant="ghost" size="lg" className="w-full justify-start text-lg py-3">
                      {item.label}
                    </Button>
                  </Link>
                ))}
                
                {user ? (
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="account" className="border-b-0">
                      <AccordionTrigger className="py-3 text-lg flex">
                        <div className="flex items-center">
                          <Avatar className="h-6 w-6 mr-2">
                            {avatarUrl ? (
                              <AvatarImage src={avatarUrl} alt={user?.displayName || "User avatar"} />
                            ) : (
                              <AvatarFallback className="bg-gray-200">{getInitials(user?.displayName)}</AvatarFallback>
                            )}
                          </Avatar>
                          アカウント管理
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-col space-y-1">
                          <Link href="/profile" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <User className="mr-2 h-4 w-4" />
                              プロフィール
                            </Button>
                          </Link>
                          <Link href="/change-password" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <Lock className="mr-2 h-4 w-4" />
                              パスワード変更
                            </Button>
                          </Link>
                          <Link href="/address" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <MapPin className="mr-2 h-4 w-4" />
                              住所管理
                            </Button>
                          </Link>
                          <Link href="/subscription" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <Calendar className="mr-2 h-4 w-4" />
                              サブスクリプション管理
                            </Button>
                          </Link>
                          <Link href="/orders" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <Package className="mr-2 h-4 w-4" />
                              注文履歴
                            </Button>
                          </Link>
                          <Link href="/wallet" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <CreditCard className="mr-2 h-4 w-4" />
                              ウォレット
                            </Button>
                          </Link>
                          <Link href="/notifications" onClick={() => setIsMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start text-md py-2">
                              <Mail className="mr-2 h-4 w-4" />
                              メール配信設定
                            </Button>
                          </Link>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
                
                <div className="pt-2">
                  {user ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full justify-center text-lg py-3 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      ログアウト
                    </Button>
                  ) : (
                    <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full justify-center text-lg py-3">
                        ログインまたは会員登録
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Navbar