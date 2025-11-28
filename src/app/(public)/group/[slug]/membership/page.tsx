"use client"

import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import type { Group } from "@/types/group"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import SubscriptionPanel from "@/components/store/SubscriptionPanel"
import LoginModal from "@/components/auth/LoginModal"
import PlayTuneBackButton from "@/components/group/FixedButton"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowRight, 
  Check, 
  Star, 
  Camera, 
  FileText, 
  Gift, 
  ShoppingBag,
  Heart,
  Users,
  Crown,
  Sparkles
} from "lucide-react"

export default function MembershipPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSubscription, setShowSubscription] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // グループの画像URL解決
  const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  // グループデータを取得
  useEffect(() => {
    const fetchGroup = async () => {
      if (!slug) return
      
      setLoading(true)
      try {
        const groupsRef = collection(db, "groups")
        const q = query(groupsRef, where("slug", "==", slug))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const groupDoc = querySnapshot.docs[0]
          const groupData = groupDoc.data()
          const groupWithId = {
            id: groupDoc.id,
            ...groupData,
          } as Group
          setGroup(groupWithId)
        }
      } catch (error) {
        console.error("Error fetching group data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [slug])

  const handleJoinClick = () => {
    if (user) {
      setShowSubscription(true)
    } else {
      setShowLoginModal(true)
    }
  }

  // サブスクリプション状態をチェック
  const isSubscribed = group?.id && user?.subscriptions?.[group.id] 
    ? user.subscriptions[group.id].status === "active" 
    : false

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-20">
        <div className="w-full px-4 sm:px-6 py-16">
          <Skeleton className="h-12 w-full max-w-md mx-auto mb-8" />
          <Skeleton className="h-64 w-full mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white px-4">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">GROUP NOT FOUND</h1>
          <p className="mb-8 text-sm sm:text-base">お探しのグループは存在しないか、削除された可能性があります。</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    )
  }

  const benefits = [
    {
      icon: <FileText className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "限定コンテンツの閲覧",
      description: "タレントブログ・スタッフダイアリー・写真・その他コンテンツ",
      detail: "ここでしか見られないメンバーの日常や撮影裏話など、特別なコンテンツを楽しめます。"
    },
    {
      icon: <Crown className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "デジタル会員証",
      description: "あなた専用のデジタル会員証を発行",
      detail: "特別な会員証で、ファンとしてのステータスを証明できます。"
    },
    {
      icon: <Gift className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "誕生日お祝い",
      description: "誕生日にはお祝いが家に届く！",
      detail: "11月中旬以降開始予定。あなたの特別な日をメンバーと一緒にお祝いします。",
      badge: "11月中旬開始予定"
    },
    {
      icon: <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8" />,
      title: "限定グッズの購入",
      description: "メンバー限定グッズを優先購入",
      detail: "一般販売前の先行販売や、メンバー限定デザインのグッズを購入できます。"
    }
  ]

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="relative min-h-screen bg-black text-white overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={resolveImageUrl(group.coverImage)}
            alt={group.name}
            fill
            className="object-cover object-center opacity-15"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90" />
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="membership-float membership-float-1"></div>
          <div className="membership-float membership-float-2"></div>
          <div className="membership-float membership-float-3"></div>
          <div className="membership-float membership-float-4"></div>
          <div className="membership-float membership-float-5"></div>
          <div className="membership-float membership-float-6"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full px-4 sm:px-6 pt-32 pb-20 min-h-screen flex items-center">
          <div className="w-full max-w-6xl mx-auto text-center">
            {/* Group Logo */}
            <div className="flex justify-center mb-8 md:mb-12">
              <div className="relative w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64">
                <Image
                  src={resolveImageUrl(group.logoUrl || group.coverImage)}
                  alt={group.name}
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Title */}
            <div className="mb-8 md:mb-12 px-2 sm:px-4">
              <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 tracking-wider break-words">
                {group.name.toUpperCase()}
              </h1>
              <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 md:mb-6">
                <div className="w-8 sm:w-16 h-1 bg-white"></div>
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0" />
                <div className="w-8 sm:w-16 h-1 bg-white"></div>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-4xl font-bold text-transparent bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text">
                OFFICIAL MEMBERSHIP
              </h2>
            </div>

            {/* Price */}
            <div className="mb-8 md:mb-12">
              <div className="inline-flex items-baseline gap-2 bg-white/10 backdrop-blur-sm rounded-full px-6 sm:px-8 py-3 sm:py-4">
                <span className="text-2xl sm:text-3xl md:text-4xl font-bold">¥440</span>
                <span className="text-base sm:text-lg text-gray-300">/ 月</span>
              </div>
            </div>

            {/* Main CTA */}
            <div className="mb-12 md:mb-16 px-4">
              {isSubscribed ? (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-green-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full mb-4">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="font-bold text-sm sm:text-base">メンバーシップ加入済み</span>
                  </div>
                  <p className="text-sm sm:text-base text-gray-300">
                    ありがとうございます！限定コンテンツをお楽しみください。
                  </p>
                </div>
              ) : (
                <Button
                  onClick={handleJoinClick}
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-base sm:text-xl font-bold px-8 sm:px-12 py-4 sm:py-6 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
                >
                  <span className="flex items-center justify-center gap-2">
                    今すぐメンバーシップに加入
                    <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:translate-x-1 flex-shrink-0" />
                  </span>
                </Button>
              )}
            </div>

            {/* Description */}
            <div className="max-w-3xl mx-auto px-4">
              <p className="text-base sm:text-lg md:text-xl text-gray-300 leading-relaxed">
                {group.name}のオフィシャルファンクラブです。<br className="hidden sm:block" />
                ここでしか見られない限定コンテンツや特典をお楽しみいただけます。
              </p>
            </div>
          </div>
        </div>

        <style jsx>{`
          .membership-float {
            position: absolute;
            background: radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, rgba(168, 85, 247, 0.2) 50%, transparent 70%);
            border-radius: 50%;
            animation: membershipFloat 8s ease-in-out infinite;
          }

          .membership-float-1 {
            width: 80px;
            height: 80px;
            top: 10%;
            left: 5%;
            animation-delay: 0s;
          }

          .membership-float-2 {
            width: 60px;
            height: 60px;
            top: 20%;
            right: 10%;
            animation-delay: 1s;
          }

          .membership-float-3 {
            width: 100px;
            height: 100px;
            top: 60%;
            left: 8%;
            animation-delay: 2s;
          }

          .membership-float-4 {
            width: 70px;
            height: 70px;
            top: 70%;
            right: 15%;
            animation-delay: 3s;
          }

          .membership-float-5 {
            width: 65px;
            height: 65px;
            top: 30%;
            left: 50%;
            animation-delay: 4s;
          }

          .membership-float-6 {
            width: 75px;
            height: 75px;
            top: 80%;
            right: 40%;
            animation-delay: 1.5s;
          }

          @media (min-width: 768px) {
            .membership-float-1 { width: 120px; height: 120px; }
            .membership-float-2 { width: 80px; height: 80px; }
            .membership-float-3 { width: 150px; height: 150px; }
            .membership-float-4 { width: 100px; height: 100px; }
            .membership-float-5 { width: 90px; height: 90px; }
            .membership-float-6 { width: 110px; height: 110px; }
          }

          @keyframes membershipFloat {
            0%, 100% {
              transform: translateY(0px) scale(1);
              opacity: 0.4;
            }
            50% {
              transform: translateY(-30px) scale(1.1);
              opacity: 0.7;
            }
          }
        `}</style>
      </section>

      {/* Benefits Section */}
      <section className="bg-black py-12 sm:py-20">
        <div className="w-full px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              メンバーシップの特典
            </h3>
            <p className="text-base sm:text-xl text-gray-300">
              月額440円で楽しめる充実の特典をご紹介
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-8 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-white border-none hover:shadow-lg transition-all duration-300 hover:scale-105">
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div className="flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                      {benefit.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h4 className="text-lg sm:text-xl font-bold text-black break-words">
                          {benefit.title}
                        </h4>
                        {benefit.badge && (
                          <Badge variant="secondary" className="bg-yellow-500 text-white text-xs w-fit">
                            {benefit.badge}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium mb-2 sm:mb-3 text-sm sm:text-base">
                        {benefit.description}
                      </p>
                      <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">
                        {benefit.detail}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-black py-12 sm:py-20">
        <div className="w-full px-4 sm:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
              よくあるご質問
            </h3>
          </div>

          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {[
              {
                question: "メンバーシップの料金はいくらですか？",
                answer: "月額440円（税込）です。グループごとに個別のメンバーシップとなります。"
              },
              {
                question: "誕生日のお祝いはいつから始まりますか？",
                answer: "2025年11月中旬以降に開始予定です。詳細は改めてお知らせいたします。"
              },
              {
                question: "解約はいつでもできますか？",
                answer: "はい、いつでも解約可能です。解約後も当月末まではサービスをご利用いただけます。"
              },
              {
                question: "限定グッズの購入について教えてください",
                answer: "メンバー限定グッズの先行販売や、メンバー限定デザインのグッズを購入できます。在庫や時期については都度お知らせします。"
              }
            ].map((faq, index) => (
              <Card key={index} className="bg-white border-none">
                <CardContent className="p-4 sm:p-6">
                  <h4 className="text-base sm:text-lg font-bold text-black mb-2 sm:mb-3">
                    Q. {faq.question}
                  </h4>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    A. {faq.answer}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-black py-12 sm:py-20">
        <div className="w-full px-4 sm:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6 sm:mb-8 leading-tight">
              今すぐ{group.name}の<br className="sm:hidden" />
              特別なファンになりませんか？
            </h3>
            
            {!isSubscribed && (
              <Button
                onClick={handleJoinClick}
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-base sm:text-xl font-bold px-8 sm:px-12 py-4 sm:py-6 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl group mb-4 sm:mb-6"
              >
                <span className="flex items-center justify-center gap-2">
                  メンバーシップに加入する
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 transition-transform group-hover:translate-x-1 flex-shrink-0" />
                </span>
              </Button>
            )}
            
            <p className="text-gray-400 text-xs sm:text-sm">
              ※ 加入後、すぐに限定コンテンツをお楽しみいただけます
            </p>
          </div>
        </div>
      </section>

      {/* Fixed Back Button */}
      <PlayTuneBackButton />

      {/* Modals */}
      {showSubscription && (
        <SubscriptionPanel 
          group={group} 
          onClose={() => setShowSubscription(false)} 
        />
      )}
      
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => {
            setShowLoginModal(false)
            setShowSubscription(true)
          }}
        />
      )}
    </div>
  )
}