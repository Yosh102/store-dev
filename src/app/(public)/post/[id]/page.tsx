"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Share, Lock, Heart, Gift } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/context/auth-context"
import { getAuth } from "firebase/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { MarkdownPreview } from "@/components/utils/markdown/markdown-preview"
import { cn } from "@/lib/utils"
import { SuperThanksModal } from "@/components/post/SuperThanks"
import SubscriptionPanel from "@/components/store/SubscriptionPanel"
import { Group } from "@/types/group"

interface PostData {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  publishDate: string
  status: "draft" | "published"
  membersOnly: boolean
  categories: string[]
  tags: string[]
  groups: string[]
  groupName: string
  groupSlug: string
  canView: boolean
  isPublished: boolean
  stats?: {
    charCount: number
    imageCount: number
    hearts?: number
    heartsCount?: number
    superThanks?: number
    superThanksCount?: number
  }
}

// Helper function to handle image URLs
const resolveImageUrl = (imageUrl: string | undefined): string => {
  if (!imageUrl) return "/placeholder.svg"
  
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
    return imageUrl
  }
  
  if (imageUrl.startsWith('/')) {
    return imageUrl
  }
  
  return `/${imageUrl}`
}

export default function PostClient() {
  const router = useRouter()
  const { user } = useAuth()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // ハート＆Super Thanks関連のstate
  const [userHeartCount, setUserHeartCount] = useState(0)
  const [totalHearts, setTotalHearts] = useState(0)
  const [isHeartAnimating, setIsHeartAnimating] = useState(false)
  const [showSuperThanksModal, setShowSuperThanksModal] = useState(false)

  // ✅ Subscription Panel用のstate（GroupReleasesShowcaseと同じパターン）
  const [subModalGroup, setSubModalGroup] = useState<Group | null>(null)
  const [loadingGroup, setLoadingGroup] = useState(false)

  const MAX_HEARTS_PER_USER = 1

  const params = useParams()
  const id = params?.id

  // ✅ 現在のページURLを取得するヘルパー関数
  const getCurrentPageUrl = () => {
    if (typeof window === 'undefined') return '/posts'
    return window.location.pathname
  }

  // ✅ ログインページへのリダイレクト（現在のページをredirectパラメータに追加）
  const redirectToLogin = () => {
    const currentUrl = getCurrentPageUrl()
    router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`)
  }

  // ✅ Subscription Panelを開く（GroupReleasesShowcaseと同じパターン）
  const openSubscriptionPanel = async () => {
    if (!user) {
      redirectToLogin()
      return
    }

    // グループIDを取得
    const groupId = post?.groups && post.groups.length > 0 ? post.groups[0] : null
    
    if (!groupId) {
      toast({
        title: "エラー",
        description: "グループ情報が見つかりません。",
        variant: "destructive"
      })
      return
    }

    // グループ情報を取得してモーダルを開く
    setLoadingGroup(true)
    try {
      const response = await fetch(`/api/groups/${groupId}`)
      if (!response.ok) throw new Error('Failed to fetch group data')
      const data = await response.json()
      
      // ✅ グループ情報を設定するだけでモーダルが開く
      setSubModalGroup(data.group)
    } catch (error) {
      console.error('Error fetching group:', error)
      toast({
        title: "エラー",
        description: "グループ情報の取得に失敗しました。",
        variant: "destructive"
      })
    } finally {
      setLoadingGroup(false)
    }
  }

  useEffect(() => {
    const fetchPost = async () => {
      if (!id) return

      try {
        // Firebase Authから直接トークンを取得
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()
        
        const headers: HeadersInit = {}
        if (token) {
          headers["Authorization"] = `Bearer ${token}`
        }

        const response = await fetch(`/api/posts/${id}`, { headers })
        const data = await response.json()

        if (data.success) {
          setPost(data.post)
        }
      } catch (error) {
        console.error("Error fetching post:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  // ハート情報の取得
  useEffect(() => {
    if (!post || !user || !post.membersOnly) return

    const fetchHeartData = async () => {
      try {
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()
        
        const response = await fetch(`/api/posts/${post.id}/hearts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        
        if (data.success) {
          setUserHeartCount(data.userCount || 0)
          setTotalHearts(data.totalHearts || 0)
        }
      } catch (error) {
        console.error('Error fetching hearts:', error)
      }
    }

    fetchHeartData()
  }, [post?.id, user, post?.membersOnly])

  // ハート送信
  const handleSendHeart = async () => {
    if (!user || !post) {
      toast({
        title: "ログインが必要です",
        description: "ハートを送るにはログインしてください。",
        variant: "destructive"
      })
      redirectToLogin()
      return
    }

    if (userHeartCount >= MAX_HEARTS_PER_USER) {
      toast({
        title: "送信済みです",
        description: "ハートは1人1回まで送れます。",
        variant: "destructive"
      })
      return
    }

    try {
      setIsHeartAnimating(true)
      
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      
      const response = await fetch(`/api/posts/${post.id}/hearts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        setUserHeartCount(prev => prev + 1)
        setTotalHearts(prev => prev + 1)
        
        toast({
          title: "❤️ ハートを送りました！",
          description: "応援ありがとうございます"
        })
      } else {
        throw new Error(data.error || 'ハートの送信に失敗しました')
      }
    } catch (error: any) {
      console.error('Error sending heart:', error)
      toast({
        title: "エラー",
        description: error.message || "ハートの送信に失敗しました。",
        variant: "destructive"
      })
    } finally {
      setTimeout(() => setIsHeartAnimating(false), 300)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: post?.title || "記事のシェア",
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast({
          title: "リンクをコピーしました",
          description: "URLがクリップボードにコピーされました。",
        })
      }
    } catch (error) {
      console.error("Error sharing:", error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-3/4 bg-gray-200 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-[400px] bg-gray-200 rounded"></div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>投稿が見つかりませんでした。</AlertDescription>
        </Alert>
      </div>
    )
  }

  // 管理者かどうかチェック
  const isAdmin = user?.role === "admin" || user?.role === "artist"

  // 公開チェック（管理者は除外）
  if (!post.isPublished && !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertDescription>
            この投稿はまだ公開されていません。
            {post.publishDate && (
              <span className="block mt-2">
                公開予定日時: {format(new Date(post.publishDate), "yyyy年MM月dd日 HH:mm")}
              </span>
            )}
          </AlertDescription>
        </Alert>
        <Button 
          className="mt-4" 
          onClick={() => router.push("/posts")}
        >
          投稿一覧に戻る
        </Button>
      </div>
    )
  }

  // 管理者向けのプレビュー通知
  const showAdminPreview = !post.isPublished && isAdmin

  // 閲覧不可の場合
  if (!post.canView) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {showAdminPreview && (
          <Alert className="mb-4 bg-yellow-50 border-yellow-200">
            <AlertDescription className="text-yellow-800">
              ⚠️ 管理者プレビュー: この投稿は{format(new Date(post.publishDate), "yyyy年MM月dd日 HH:mm")}に公開されます
            </AlertDescription>
          </Alert>
        )}
        
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold mb-8">{post.title}</h1>
          <div className="max-w-lg mx-auto">
            {/* Display thumbnail if available */}
            {post.thumbnailUrl && (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg mb-4">
                <Image
                  src={resolveImageUrl(post.thumbnailUrl)}
                  alt={post.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            )}
            {/* Show sanitized preview */}
            <MarkdownPreview content={post.content} />
            
            {/* Paywall design */}
            <div className="mt-8 bg-gray-50 rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-800 mb-4">ここから先はメンバーシップ限定コンテンツです</h3>
                
                <div className="border-t-2 border-dotted border-gray-300 mb-6"></div>
                
                <div className="text-gray-600 mb-6">
                  <span className="text-sm">
                    {post.stats?.charCount || 0}字 {(post.stats?.imageCount || 0) > 0 && `/ ${post.stats?.imageCount}画像`}
                  </span>
                </div>
                
                <Button
                  size="lg"
                  onClick={openSubscriptionPanel}
                  disabled={loadingGroup}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-md py-4 text-base font-medium transition-colors"
                >
                  {loadingGroup ? "読み込み中..." : "メンバーシップに参加する"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Subscription Panel モーダル（GroupReleasesShowcaseと同じパターン） */}
        {subModalGroup && (
          <SubscriptionPanel
            group={subModalGroup as any}
            onClose={() => setSubModalGroup(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 管理者プレビュー通知 */}
      {showAdminPreview && (
        <Alert className="mb-4 bg-yellow-50 border-yellow-200">
          <AlertDescription className="text-yellow-800">
            ⚠️ 管理者プレビュー: この投稿は{format(new Date(post.publishDate), "yyyy年MM月dd日 HH:mm")}に公開されます
          </AlertDescription>
        </Alert>
      )}

      {/* Title Section */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          {post.membersOnly && (
            <div
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full",
                "bg-gradient-to-r from-emerald-500 to-sky-500 text-white",
                "text-sm font-medium",
              )}
            >
              <Lock className="h-4 w-4" />
              <span>{post.groupName ? `${post.groupName}メンバーシップ限定` : "メンバーシップ限定"}</span>
            </div>
          )}
          <time className="text-gray-500" dateTime={post.publishDate}>
            {format(new Date(post.publishDate), "yyyy.MM.dd")}
          </time>
        </div>
        <h1 className="text-2xl md:text-4xl font-bold">{post.title}</h1>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {post.thumbnailUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg">
            <Image
              src={resolveImageUrl(post.thumbnailUrl)}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Post Content */}
        <div className="mt-8">
          <MarkdownPreview content={post.content || ""} />
        </div>

        {/* ハート & Special Cheer セクション（メンバーシップ限定記事のみ） */}
        {post.membersOnly && post.canView && (
          <div className="mt-12 border-t pt-8">
            <div className="text-center space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">
                PLAY TUNEを応援する👍
              </h3>
              
              {/* 丸ボタングループ */}
              <div className="flex items-center justify-center gap-6 sm:gap-8">
                {/* ハートボタン */}
                <button
                  onClick={handleSendHeart}
                  disabled={userHeartCount >= MAX_HEARTS_PER_USER}
                  aria-label={userHeartCount > 0 ? "ハート送信済み" : "ハートを送る"}
                  className={cn(
                    "relative group",
                    "w-24 h-24 sm:w-28 sm:h-28 rounded-full",
                    "flex flex-col items-center justify-center gap-1",
                    userHeartCount > 0
                      ? "bg-gradient-to-br from-gray-200 to-gray-300 cursor-not-allowed"
                      : "bg-gradient-to-br from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600",
                    "transition-all duration-300",
                    userHeartCount === 0 && "hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl",
                    isHeartAnimating && "scale-90"
                  )}
                >
                  <span 
                    className={cn(
                      "text-3xl sm:text-4xl transition-transform",
                      isHeartAnimating && "animate-pulse scale-125"
                    )}
                  >
                    😍
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {userHeartCount > 0 ? "送信済み" : "ハート"}
                  </span>
                </button>

                {/* Special Cheer ボタン */}
                <button
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: "ログインが必要です",
                        description: "Special Cheerを送るにはログインしてください。",
                        variant: "destructive"
                      })
                      redirectToLogin()
                      return
                    }
                    setShowSuperThanksModal(true)
                  }}
                  aria-label="Special Cheerを送る"
                  className={cn(
                    "relative group",
                    "w-24 h-24 sm:w-28 sm:h-28 rounded-full",
                    "flex flex-col items-center justify-center gap-1",
                    "bg-gradient-to-br from-amber-500 to-orange-500",
                    "hover:from-amber-600 hover:to-orange-600",
                    "transition-all duration-300",
                    "hover:scale-110 active:scale-95",
                    "shadow-lg hover:shadow-xl"
                  )}
                >
                  <span className="text-3xl sm:text-4xl transition-transform group-hover:rotate-12">
                    🎉
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                    Cheer
                  </span>
                </button>
              </div>

              {/* 統計表示 */}
              {post.stats && ((post.stats.hearts || 0) > 0 || (post.stats.superThanks || 0) > 0) && (
                <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-100">
                  {(post.stats.hearts || 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-pink-100 flex items-center justify-center">
                        <span className="text-sm">😍</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{post.stats.hearts}</span>
                    </div>
                  )}
                  
                  {(post.stats.superThanks || 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                        <span className="text-sm">🎉</span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">{post.stats.superThanks}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Large Share Button */}
        <div className="mt-8 mb-8">
          <Button
            onClick={handleShare}
            className="w-full bg-black hover:bg-gray-800 text-white rounded-full py-6 text-lg font-medium flex items-center gap-2 transition-all"
          >
            <Share className="h-6 w-6" />
            シェアする
          </Button>
        </div>
      </div>

      {/* ✅ Super Thanks モーダル */}
      <SuperThanksModal
        isOpen={showSuperThanksModal}
        onClose={() => setShowSuperThanksModal(false)}
        post={{
          id: post.id,
          title: post.title,
          thumbnailUrl: post.thumbnailUrl,
          groupName: post.groupName
        }}
      />

      {/* ✅ Subscription Panel モーダル（GroupReleasesShowcaseと同じパターン） */}
      {subModalGroup && (
        <SubscriptionPanel
          group={subModalGroup as any}
          onClose={() => setSubModalGroup(null)}
        />
      )}
    </div>
  )
}