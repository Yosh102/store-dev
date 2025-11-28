"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import type { Group } from "@/types/group"
import { useAuth } from "@/context/auth-context"
import SubscriptionPanel from "@/components/store/SubscriptionPanel"
import LoginModal from "@/components/auth/LoginModal"

interface JoinSectionProps {
  group: Group
}

const JoinSection: React.FC<JoinSectionProps> = ({ group }) => {
  const { user } = useAuth()
  const [showSubscription, setShowSubscription] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // グループの画像URL解決
  const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  const handleJoinClick = () => {
    if (user) {
      setShowSubscription(true)
    } else {
      setShowLoginModal(true)
    }
  }

  return (
    <>
      <section id="join-section" className="relative min-h-screen bg-black text-white overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={resolveImageUrl(group.coverImage)}
            alt={group.name}
            fill
            className="object-cover object-center opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/90" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 py-20 min-h-screen flex items-center">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side - Group Logo/Image */}
            <div className="flex justify-center">
              <div className="relative">
                {/* Main Logo */}
                <div className="relative w-80 h-80 md:w-96 md:h-96">
                  <Image
                    src={resolveImageUrl(group.logoUrl || group.coverImage)}
                    alt={group.name}
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Right Side - Content */}
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-wider">
                  {group.name.toUpperCase()} MEMERSHIP
                </h2>
                <div className="w-24 h-1 bg-white mb-8"></div>
              </div>

              <div className="space-y-6 text-lg leading-relaxed">
                <p>
                  {group.name}のオフィシャルファンクラブです。
                </p>
                <p>
                  ここでしか見られない動画や写真など<br />
                  充実のコンテンツをお楽しみいただけます。
                </p>
              </div>

              {/* Join Button */}
              <div className="pt-8">
                <Button
                  onClick={handleJoinClick}
                  size="lg"
                  className="w-full md:w-auto bg-white text-black hover:bg-gray-100 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
                >
                  新規入会はこちら
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

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
    </>
  )
}

export default JoinSection