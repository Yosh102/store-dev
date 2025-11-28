"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/context/auth-context"
import { getAuth } from "firebase/auth"
import { useSwipeable } from "react-swipeable"

interface PostCarouselProps {
  category?: string
  tag?: string
  limit?: number
  className?: string
}

interface CarouselPost {
  id: string
  title: string
  thumbnailUrl?: string
  pickup_thumb?: string
  pickup_thumb_pc?: string
  pickup_title_color?: string
  pickup_subtitle?: string
  pickup_color?: string
}

function resolveImageUrl(u?: string) {
  if (u && /^https?:\/\//.test(u)) return u
  if (u) return u
  return "/placeholder.png"
}

function safeColor(hex?: string, fallback = "#ffffff") {
  if (!hex) return fallback
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex) ? hex : fallback
}

export default function PostCarousel({
  category,
  tag,
  limit: postLimit = 5,
  className,
}: PostCarouselProps) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<CarouselPost[]>([])
  const [currentIndex, setCurrentIndex] = useState(2)
  const [loading, setLoading] = useState(true)

  /** APIから記事取得 */
  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        type: "carousel",
        limit: postLimit.toString(),
      })
      
      if (category) params.append("category", category)
      if (tag) params.append("tag", tag)
      
      // Firebase Authから直接トークンを取得
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      
      const headers: HeadersInit = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      
      const response = await fetch(`/api/posts?${params}`, { headers })
      const data = await response.json()
      
      if (data.success) {
        return data.posts
      }
      return []
    } catch (error) {
      console.error("Error fetching posts:", error)
      return []
    }
  }, [category, tag, postLimit])

  useEffect(() => {
    ;(async () => {
      const p = await fetchPosts()
      setPosts(p)
      setLoading(false)
      if (p.length <= 1) {
        setCurrentIndex(0)
      } else {
        setCurrentIndex(2)
      }
    })()
  }, [fetchPosts])

  /** カルーセル用に先頭と末尾を複製して無限ループ風に */
  const getDisplayPosts = useCallback(() => {
    if (posts.length === 0) return []
    if (posts.length === 1) return [posts[0]]
    return [
      posts[posts.length - 2],
      posts[posts.length - 1],
      ...posts,
      posts[0],
      posts[1],
    ]
  }, [posts])

  const displayPosts = useMemo(getDisplayPosts, [getDisplayPosts])
  const actualIndex = posts.length <= 1 ? 0 : currentIndex - 2

  // 自動スライド（2件以上の時のみ）
  useEffect(() => {
    if (posts.length <= 1) return
    const t = setInterval(() => setCurrentIndex((i) => i + 1), 6000)
    return () => clearInterval(t)
  }, [posts])

  // 無限ループ調整（2件以上の時のみ）
  const handleTransitionEnd = () => {
    if (posts.length <= 1) return
    const n = posts.length
    if (currentIndex <= 1) setCurrentIndex(n + 1)
    else if (currentIndex >= n + 2) setCurrentIndex(2)
  }

  const nextSlide = () => posts.length > 1 && setCurrentIndex((i) => i + 1)
  const prevSlide = () => posts.length > 1 && setCurrentIndex((i) => i - 1)
  const handleIndicatorClick = (i: number) =>
    posts.length > 1 && setCurrentIndex(i + 2)

  // スワイプイベント（2件以上の時のみ）
  const handlers = useSwipeable({
    onSwipedLeft: () => nextSlide(),
    onSwipedRight: () => prevSlide(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  })

  if (loading) {
    return (
      <div className={`space-y-4 md:space-y-8 ${className || ""}`}>
        <div className="relative w-full overflow-hidden">
          <div className="animate-pulse bg-gray-200 rounded-2xl h-64 md:h-96"></div>
        </div>
      </div>
    )
  }

  if (posts.length === 0) return null

  return (
    <div className={`space-y-4 md:space-y-8 ${className || ""}`}>
      <div className="relative w-full overflow-hidden">
        <div
          {...handlers}
          className="flex transition-transform duration-700 ease-out"
          style={{
            transform:
              posts.length > 1
                ? `translateX(calc(-${currentIndex * 100}%))`
                : "translateX(0%)",
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {displayPosts.map((post, i) => {
            const isActive = posts.length === 1 ? true : i === currentIndex
            const bgColor = safeColor(post.pickup_color, "#333333")
            const titleColor = safeColor(post.pickup_title_color, "#ffffff")
            const subtitle = post.pickup_subtitle?.trim()
            const pickupThumb = post.pickup_thumb

            return (
              <div key={`${post.id}-${i}`} className="flex-[0_0_100%]">
                <div
                  className={`rounded-2xl overflow-hidden ring-1 ring-black/5 transition-all duration-500 ${
                    isActive ? "scale-100" : "scale-95 opacity-60"
                  }`}
                  style={{ backgroundColor: bgColor }}
                >
                  {/* === PC: 左にpickup_thumb_pc(4:3角丸)、右にタイトル＋副題 === */}
                  <div className="hidden md:grid md:grid-cols-12 md:gap-8 p-8 items-center">
                    <div className="md:col-span-5 flex">
                      <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden">
                         <Image
                          src={resolveImageUrl(post.pickup_thumb_pc || pickupThumb)}
                          alt={post.title}
                          fill
                          className="object-cover"
                          priority={isActive}
                          unoptimized
                        />
                      </div>
                    </div>
                    <div className="md:col-span-7 flex flex-col justify-center">
                      <Link href={`/post/${post.id}`}>
                        <h3
                          className="text-4xl/tight font-extrabold hover:underline"
                          style={{ color: titleColor }}
                        >
                          {post.title}
                        </h3>
                      </Link>
                      {subtitle && (
                        <p className="mt-3 text-lg" style={{ color: titleColor, opacity: 0.85 }}>
                          {subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* === SP: pickup_thumb正方形 + 下部文字 === */}
                  <div className="md:hidden">
                    <Link
                      href={`/post/${post.id}`}
                      className="block relative w-full aspect-square rounded-2xl overflow-hidden"
                    >
                      {pickupThumb ? (
                        <Image
                          src={resolveImageUrl(pickupThumb)}
                          alt={post.title}
                          fill
                          className="object-cover"
                          priority={isActive}
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gray-500" />
                      )}

                      {/* 下35%に帯を作り、その中で上下中央にタイトル＆副題 */}
                      <div className="absolute bottom-0 left-0 right-0 h-[35%] flex flex-col justify-center text-center px-3">
                        <h3
                          className="text-lg font-extrabold"
                          style={{ color: titleColor }}
                        >
                          {post.title}
                        </h3>
                        {subtitle && (
                          <p
                            className="mt-1 text-sm"
                            style={{ color: titleColor, opacity: 0.9 }}
                          >
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Prev / Next（PCのみ、2件以上のときだけ表示） */}
        {posts.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden md:flex absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-12 md:h-12 rounded-full bg-white/90 shadow-lg items-center justify-center hover:scale-110 focus:outline-none z-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="hidden md:flex absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-9 h-9 md:w-12 md:h-12 rounded-full bg-white/90 shadow-lg items-center justify-center hover:scale-110 focus:outline-none z-10"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </>
        )}
      </div>

      {/* インジケータ（2件以上の時のみ表示） */}
      {posts.length > 1 && (
        <div className="flex justify-center items-center gap-1 md:gap-2">
          {posts.map((_, i) => {
            const active =
              (actualIndex < 0 && i === posts.length + actualIndex) ||
              (actualIndex >= posts.length && i === actualIndex - posts.length) ||
              i === actualIndex
            return (
              <button
                key={i}
                onClick={() => handleIndicatorClick(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1 w-8 md:w-16 rounded-full transition-all duration-300 ${
                  active ? "bg-gray-500" : "bg-gray-400/50 hover:bg-gray-400/70"
                }`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}