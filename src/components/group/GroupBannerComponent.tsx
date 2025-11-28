"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GroupBanner } from "@/types/group"

interface GroupBannerCarouselProps {
  banners: GroupBanner[]
}

const GroupBannerCarousel: React.FC<GroupBannerCarouselProps> = ({ banners }) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // 有効なバナーのみをフィルタリング
  const activeBanners = banners.filter(banner => {
    const now = new Date()
    const startDate = banner.startDate.toDate()
    const endDate = banner.endDate.toDate()
    return banner.isActive && now >= startDate && now <= endDate
  }).sort((a, b) => a.priority - b.priority)

  // 開発環境で1つしかない場合は複製して7つ表示
  let displayBanners = activeBanners
  if (process.env.NODE_ENV === 'development' && activeBanners.length === 1) {
    displayBanners = Array.from({ length: 7 }, (_, index) => ({
      ...activeBanners[0],
      id: `${activeBanners[0].id}-${index}` // 重複IDを避けるため
    }))
  }

  // 自動スライド - 常にuseEffectを呼び出し、内部で条件チェック
  useEffect(() => {
    // バナーがない場合や1つしかない場合、自動再生が無効な場合は何もしない
    if (!isAutoPlaying || displayBanners.length <= 1) {
      return
    }

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => 
        prevIndex === displayBanners.length - 1 ? 0 : prevIndex + 1
      )
    }, 5000) // 5秒間隔

    return () => clearInterval(interval)
  }, [isAutoPlaying, displayBanners.length])

  // バナーがない場合は何も表示しない - useEffectの後に配置
  if (displayBanners.length === 0) {
    return null
  }

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? displayBanners.length - 1 : currentIndex - 1)
    setIsAutoPlaying(false)
    
    // 3秒後に自動再生を再開
    setTimeout(() => setIsAutoPlaying(true), 3000)
  }

  const goToNext = () => {
    setCurrentIndex(currentIndex === displayBanners.length - 1 ? 0 : currentIndex + 1)
    setIsAutoPlaying(false)
    
    // 3秒後に自動再生を再開
    setTimeout(() => setIsAutoPlaying(true), 3000)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setIsAutoPlaying(false)
    
    // 3秒後に自動再生を再開
    setTimeout(() => setIsAutoPlaying(true), 3000)
  }

  const resolveImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return "/placeholder.svg"
    
    // Firebase Storage URLまたはhttps://で始まるURLの場合はそのまま使用
    if (imageUrl.includes('firebasestorage.googleapis.com') || 
        imageUrl.startsWith('https://') || 
        imageUrl.startsWith('http://')) {
      return imageUrl
    }
    
    // 相対パスの場合
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  const BannerContent = ({ banner, isCenter }: { banner: GroupBanner; isCenter: boolean }) => (
    <div className={`relative w-full rounded-lg overflow-hidden group cursor-pointer transition-all duration-300 ${
      isCenter ? 'scale-100 opacity-100' : 'scale-100 opacity-90'
    }`} style={{ aspectRatio: '320/100' }}>
      <Image
        src={resolveImageUrl(banner.imageUrl)}
        alt={banner.title}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        priority={isCenter}
      />
      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors duration-300" />
    </div>
  )

  return (
    <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] bg-black py-1 md:py-2">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="relative w-full">
          {/* バナー表示エリア - モバイル（1つ表示） */}
          <div className="relative overflow-hidden sm:hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ 
                transform: `translateX(-${currentIndex * 100}%)`,
              }}
            >
              {displayBanners.map((banner, index) => (
                <div 
                  key={banner.id} 
                  className="flex-shrink-0 w-full flex justify-center"
                  onClick={() => {
                    if (index !== currentIndex) {
                      goToSlide(index)
                    } else if (banner.linkUrl) {
                      window.open(banner.linkUrl, '_blank')
                    }
                  }}
                >
                  <div className="w-full max-w-lg">
                    <BannerContent 
                      banner={banner} 
                      isCenter={index === currentIndex}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* バナー表示エリア - タブレット（2つ表示） */}
          <div className="relative overflow-hidden hidden sm:block md:hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out gap-2 justify-center"
              style={{ 
                transform: `translateX(-${currentIndex * 51}%)`,
              }}
            >
              {displayBanners.map((banner, index) => (
                <div 
                  key={banner.id} 
                  className="flex-shrink-0"
                  style={{ width: '49%', maxWidth: '400px' }}
                  onClick={() => {
                    if (index !== currentIndex) {
                      goToSlide(index)
                    } else if (banner.linkUrl) {
                      window.open(banner.linkUrl, '_blank')
                    }
                  }}
                >
                  <BannerContent 
                    banner={banner} 
                    isCenter={index === currentIndex}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* バナー表示エリア - デスクトップ（3つ表示） */}
          <div className="relative overflow-hidden hidden md:block">
            <div 
              className="flex transition-transform duration-500 ease-in-out gap-2 justify-center"
              style={{ 
                transform: `translateX(-${currentIndex * 34}%)`,
              }}
            >
              {displayBanners.map((banner, index) => (
                <div 
                  key={banner.id} 
                  className="flex-shrink-0"
                  style={{ width: '32%', maxWidth: '450px' }}
                  onClick={() => {
                    if (index !== currentIndex) {
                      goToSlide(index)
                    } else if (banner.linkUrl) {
                      window.open(banner.linkUrl, '_blank')
                    }
                  }}
                >
                  <BannerContent 
                    banner={banner} 
                    isCenter={index === currentIndex}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ナビゲーションボタン（複数バナーがある場合のみ） */}
          {displayBanners.length > 1 && (
            <>
              {/* 左矢印 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 md:w-8 md:h-8 z-10"
                onClick={goToPrevious}
              >
                <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" strokeWidth={2} />
              </Button>

              {/* 右矢印 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 md:w-8 md:h-8 z-10"
                onClick={goToNext}
              >
                <ChevronRight className="w-3 h-3 md:w-4 md:h-4" strokeWidth={2} />
              </Button>

              {/* インジケーター */}
              <div className="flex justify-center mt-1 md:mt-2 space-x-1">
                {displayBanners.map((_, index) => (
                  <button
                    key={index}
                    className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all duration-300 ${
                      index === currentIndex 
                        ? 'bg-white scale-125' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    onClick={() => goToSlide(index)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default GroupBannerCarousel