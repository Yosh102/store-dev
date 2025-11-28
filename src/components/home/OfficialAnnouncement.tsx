"use client"

import { useState, useEffect } from "react"
import { X, AlertCircle } from "lucide-react"
import Link from "next/link"
import { getPosts } from "@/services/post-service"
import type { Post } from "@/services/post-service"
import type { Timestamp } from "firebase/firestore"

interface OfficialAnnouncementProps {
  className?: string
}

export default function OfficialAnnouncement({ className }: OfficialAnnouncementProps) {
  const [announcement, setAnnouncement] = useState<Post | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const fetchOfficialAnnouncement = async () => {
      try {
        // 開発環境の場合はダミーのお知らせを表示
        if (process.env.NODE_ENV === 'development') {
          const dummyAnnouncement: Post = {
            id: 'dev-announcement',
            title: '【重要】配送遅延のお知らせ',
            content: '現在、配送業者の都合により商品の配送に遅延が生じております。ご迷惑をおかけして申し訳ございません。',
            thumbnailUrl: '',
            publishDate: { seconds: Date.now() / 1000, nanoseconds: 0 } as Timestamp,
            status: 'published',
            membersOnly: false,
            categories: ['official-announce'],
            tags: [],
            groups: [],
            isOfficialAnnouncement: true,
            // Post型に存在しないプロパティは削除
            // createdAt と updatedAt はPost型にない場合は含めない
          }
          setAnnouncement(dummyAnnouncement)
          setIsVisible(true)
          return
        }

        // 本番環境では公式お知らせフラグがtrueの記事を取得
        const posts = await getPosts({ 
          postLimit: 10 
        })
        
        // isOfficialAnnouncementがtrueの記事をフィルタリング
        const officialAnnouncements = posts.filter(post => post.isOfficialAnnouncement)
        
        if (officialAnnouncements.length > 0) {
          // 最新の公式お知らせを取得（publishDateでソート）
          const latestAnnouncement = officialAnnouncements.sort((a, b) => 
            b.publishDate.seconds - a.publishDate.seconds
          )[0]
          setAnnouncement(latestAnnouncement)
          setIsVisible(true)
        }
      } catch (error) {
        console.error("Error fetching official announcement:", error)
      }
    }

    fetchOfficialAnnouncement()
  }, [])

  // ローカルストレージの確認を別のuseEffectで処理
  useEffect(() => {
    if (!announcement) return

    // ローカルストレージから非表示状態を確認
    const dismissedKey = `announcement-dismissed-${announcement.id}`
    const dismissed = localStorage.getItem(dismissedKey)
    if (dismissed) {
      setIsDismissed(true)
    }
  }, [announcement])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    
    // ローカルストレージに非表示状態を保存
    const dismissedKey = `announcement-dismissed-${announcement?.id || 'dev'}`
    localStorage.setItem(dismissedKey, 'true')
  }

  // お知らせがない、または非表示にされた場合は何も表示しない
  if (!announcement || isDismissed || !isVisible) {
    return null
  }

  const isDevAnnouncement = announcement.id === 'dev-announcement'

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {isDevAnnouncement ? (
              <div>
                <h3 className="font-semibold text-red-900">
                  {announcement.title}
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  {announcement.content}
                </p>
              </div>
            ) : (
              <div>
                <Link 
                  href={`/post/${announcement.id}`}
                  className="group inline-block"
                >
                  <h3 className="font-semibold text-red-900 mb-1 group-hover:text-red-700 transition-colors underline">
                    {announcement.title}
                  </h3>
                </Link>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {announcement.content.length > 100 
                    ? `${announcement.content.substring(0, 100)}...` 
                    : announcement.content
                  }
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-red-100 rounded-full transition-colors"
            aria-label="お知らせを閉じる"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>
    </div>
  )
}