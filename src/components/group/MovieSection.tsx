"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HomeMovie } from "@/types/group"
import type { Group } from "@/types/group"

interface MovieSectionProps {
  group: Group
  movies: HomeMovie[]
}

// YouTube URLからVideo IDを抽出する関数
const extractYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

// YouTube Video IDからサムネイルURLを生成
const getYouTubeThumbnail = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

// YouTube Video IDから埋め込みURLを生成
const getYouTubeEmbedUrl = (videoId: string): string => {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
}

const MovieSection: React.FC<MovieSectionProps> = ({ group, movies }) => {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null)

  // 有効な動画のみをフィルタリング
  const activeMovies = movies.filter(movie => {
    const now = new Date()
    const startDate = movie.startDate.toDate()
    const endDate = movie.endDate.toDate()
    return movie.isActive && now >= startDate && now <= endDate
  }).sort((a, b) => a.priority - b.priority)

  // 動画がない場合は何も表示しない
  if (activeMovies.length === 0) {
    return null
  }

  // グループの画像URL解決
  const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }

  const handleVideoClick = (movie: HomeMovie) => {
    const videoId = extractYouTubeVideoId(movie.youtubeUrl)
    if (videoId) {
      setPlayingVideoId(videoId)
    }
  }

  const handleCloseVideo = () => {
    setPlayingVideoId(null)
  }

  return (
    <div className="relative min-h-[60vh] overflow-hidden">
      {/* Background Image with Blur and Grayscale */}
      <div className="absolute inset-0">
        <Image
          src={resolveImageUrl(group.coverImage)}
          alt={group.name}
          fill
          className="object-cover"
          style={{
            filter: 'blur(20px) grayscale(100%)',
            transform: 'scale(1.1)' // Slight zoom to hide blur edges
          }}
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">MOVIE</h2>
        </div>

        {/* Playing Video (Full Width) */}
        {playingVideoId && (
          <div className="mb-12 max-w-4xl mx-auto">
            <div className="relative bg-black rounded-lg overflow-hidden">
              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full"
                onClick={handleCloseVideo}
              >
                <X className="w-6 h-6" strokeWidth={2} />
              </Button>

              {/* YouTube Embed */}
              <div className="relative aspect-video w-full">
                <iframe
                  src={getYouTubeEmbedUrl(playingVideoId)}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Movie Grid - スマホは1列、タブレットは2列、デスクトップは4列 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {activeMovies.map((movie) => {
            const videoId = extractYouTubeVideoId(movie.youtubeUrl)
            if (!videoId) return null

            const isPlaying = playingVideoId === videoId

            return (
              <div
                key={movie.id}
                className={`group cursor-pointer transform transition-all duration-300 hover:scale-105 ${
                  isPlaying ? 'opacity-50 scale-95' : ''
                }`}
                onClick={() => handleVideoClick(movie)}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300">
                  {/* YouTube Thumbnail - 通常のimgタグを使用 */}
                  <img
                    src={getYouTubeThumbnail(videoId)}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  
                  {/* Overlay Content */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30">
                    {/* Play Button - より大きく、押しやすく */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white/95 rounded-full flex items-center justify-center transform transition-all duration-300 group-hover:scale-125 group-hover:bg-white shadow-lg">
                        <Play className="w-6 h-6 md:w-6 md:h-6 text-black ml-1" fill="currentColor" />
                      </div>
                    </div>

                    {/* Title Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="text-white text-sm md:text-base font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center">
                        クリックして再生
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Instructions */}
        {!playingVideoId && activeMovies.length > 0 && (
          <div className="text-center mt-8">
            <p className="text-gray-300 text-sm">動画をクリックして再生</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MovieSection