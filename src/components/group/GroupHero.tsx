"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Heart, CreditCard } from "lucide-react"
import { FavoriteMemberBadge } from "@/components/group/FavoriteMemberBadge"
import { MembershipCard } from "@/components/group/MembershipCard"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Group } from "@/types/group"
import type { FavoriteMember } from "@/types/user"
import { cn } from "@/lib/utils"

interface SubdomainHeroProps {
  group: Group
  isSubscribed: boolean
  hasFavoriteMember: boolean
  favoriteMember: FavoriteMember | null
  favoriteMemberAvatar?: string
  memberSince?: any
  onSubscribeClick: () => void
  onFavoriteMemberClick: () => void
  onShowMembershipCard: () => void
}

const SubdomainHero: React.FC<SubdomainHeroProps> = ({
  group,
  isSubscribed,
  hasFavoriteMember,
  favoriteMember,
  favoriteMemberAvatar,
  memberSince,
  onSubscribeClick,
  onFavoriteMemberClick,
  onShowMembershipCard,
}) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // グループの画像URL解決
  const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  const containerStyle = {
    backgroundColor: group.backgroundColor || undefined,
    color: group.textColor || undefined,
    backgroundImage: group.backgroundGradient || undefined,
  }

  if (!mounted) {
    return <div className="min-h-screen bg-black" />
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={containerStyle}>
      {group.customCSS && (
        <style jsx global>{`
          ${group.customCSS}
        `}</style>
      )}

      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0">
        <div className="relative w-full h-full">
          <Image
            src={resolveImageUrl(group.coverImage)}
            alt={group.name}
            fill
            priority
            className="object-cover object-center"
            style={{ 
              objectFit: "cover",
              transform: "scale(1.1)" // Slight zoom for parallax effect
            }}
          />
          
          {/* Gradient Overlay - darker and more dramatic */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />
          
          {/* Noise texture overlay for film-like effect */}
          <div 
            className="absolute inset-0 opacity-20 mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center items-center min-h-screen px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Group Logo (if different from cover) */}
          {group.logoUrl && group.logoUrl !== group.coverImage && (
            <div className="mb-8 animate-fadeInUp mt-8 pt-16" style={{ animationDelay: '0.2s' }}>
              <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-white/10 backdrop-blur-sm p-4">
                <Image
                  src={resolveImageUrl(group.logoUrl)}
                  alt={`${group.name} logo`}
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Group Name - Larger and more dramatic */}
          <div className="mb-8 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold text-white mb-4 tracking-wider transform">
              {group.name.toUpperCase()}
            </h1>
          </div>

          {/* Introduction Text - Only if no favorite member */}
          {!hasFavoriteMember && group.introduction && (
            <div className="mb-12 animate-fadeInUp" style={{ animationDelay: '1.0s' }}>
              <p className="text-xl md:text-2xl text-white/90 font-light tracking-wide max-w-2xl mx-auto leading-relaxed">
                {group.introduction}
              </p>
            </div>
          )}
        </div>

        {/* Scroll Indicator - 修正済み */}
        <div className="bottom-8 right-8 animate-bounce">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white opacity-75">
                <path 
                  d="M7 10L12 15L17 10" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="animate-pulse"
                />
            </svg>
        </div>
      </div>
    </div>
  )
}

export default SubdomainHero