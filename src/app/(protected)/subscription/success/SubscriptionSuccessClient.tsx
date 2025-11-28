"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import Link from "next/link"
import { X, Calendar, CreditCard, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { FeedbackModal } from "@/components/store/FeedbackModal"
import Image from "next/image"

type FeedbackKind = "good" | "bad"

export default function SubscriptionSuccessClient() {
  const searchParams = useSearchParams()
  const { user, getIdToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)
  const [feedbackType, setFeedbackType] = useState<FeedbackKind | null>(null)
  const [hasFeedback, setHasFeedback] = useState(false)
  const [submittedFeedbackType, setSubmittedFeedbackType] = useState<FeedbackKind | null>(null)

  const subscriptionId = searchParams.get("subscription_id") || ""

  const authorizedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getIdToken()
      const headers = new Headers(init?.headers || {})
      headers.set("Authorization", `Bearer ${token}`)
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }
      return fetch(url, { ...init, headers })
    },
    [getIdToken]
  )

  useEffect(() => {
    let cancelled = false

    const verifySubscription = async () => {
      if (!subscriptionId) {
        setError("サブスクリプションIDが見つかりません")
        setLoading(false)
        return
      }
      if (!user) {
        // 未ログイン。ログイン後に再マウントされる想定
        setError("確認にはログインが必要です")
        setLoading(false)
        return
      }

      // Stripe 反映のタイムラグに備え、指数バックオフでリトライ
      const maxAttempts = 5
      let attempt = 0
      let lastErr: unknown = null

      while (attempt < maxAttempts && !cancelled) {
        try {
          // 最初にちょっと待ってから（Checkout完了→Webhook→DB反映の猶予）
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1200))
          }

          const res = await authorizedFetch(
            `/api/stripe/verify-subscription?subscription_id=${encodeURIComponent(subscriptionId)}`
          )
          const data = await res.json()

          if (!res.ok) {
            // 404 や 409 はまだ整合が取れていない可能性があるのでリトライ
            if ([404, 409, 425].includes(res.status) && attempt < maxAttempts - 1) {
              attempt++
              const wait = 800 * Math.pow(1.6, attempt) // 800ms, 1280ms, ...
              await new Promise((r) => setTimeout(r, wait))
              continue
            }
            throw new Error(data?.error || "サブスクリプションの確認に失敗しました")
          }

          if (!cancelled) {
            setSubscriptionDetails(data.subscription)
            setError(null)
            setLoading(false)
          }
          return
        } catch (e) {
          lastErr = e
          if (attempt < maxAttempts - 1) {
            attempt++
            const wait = 800 * Math.pow(1.6, attempt)
            await new Promise((r) => setTimeout(r, wait))
            continue
          } else {
            break
          }
        }
      }

      if (!cancelled) {
        setError(
          lastErr instanceof Error
            ? lastErr.message
            : "サブスクリプションの確認に失敗しました。時間を置いて再度お試しください。"
        )
        setLoading(false)
      }
    }

    verifySubscription()
    return () => {
      cancelled = true
    }
  }, [subscriptionId, user, authorizedFetch])

  const handleFeedbackSubmit = (type: FeedbackKind) => {
    setHasFeedback(true)
    setSubmittedFeedbackType(type)
  }

  const translateSubscriptionStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      active: "アクティブ",
      canceled: "キャンセル済み",
      incomplete: "未完了",
      incomplete_expired: "期限切れ",
      past_due: "支払い遅延",
      trialing: "トライアル中",
      unpaid: "未払い",
    }
    return statusMap[status] || status
  }

  const translatePlanType = (planType: string): string => {
    const planMap: Record<string, string> = {
      monthly: "月額プラン",
      yearly: "年額プラン",
      basic: "ベーシックプラン",
      premium: "プレミアムプラン",
      pro: "プロプラン",
    }
    return planMap[planType] || planType
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">処理中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto text-center space-y-6">
          <div className="relative my-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              {/* 目立ちすぎるアイコンを避けるため X をそのまま使用 */}
              <X className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">確認に失敗しました</h1>
          <p className="text-gray-600">{error}</p>
          <div className="flex gap-3 justify-center mt-4">
            <Button asChild variant="outline">
              <Link href="/">ホームへ</Link>
            </Button>
            <Button asChild>
              <Link href="/subscription">サブスク管理へ</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* ヘッダー */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center p-4">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/">
            <X className="h-6 w-6" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          ヘルプ
        </Button>
      </div>

      {/* コンテンツ */}
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        {/* イラスト */}
        <div className="relative my-8">
          <Image
            src="/img/shopping_bag.png"
            alt="Order Success"
            width={200}
            height={200}
            className="object-contain mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold">サブスクリプション登録完了</h1>
        <p className="text-gray-600">
          {user?.displayName}さん、メンバーシップへのご登録ありがとうございます。
          {!hasFeedback && " 今回のご登録についてご感想をお聞かせください。"}
        </p>

        {/* サブスクリプション詳細 */}
        {subscriptionDetails && (
          <div className="bg-gray-50 rounded-lg p-6 space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-gray-600 mr-2" />
                <span className="text-gray-700 font-medium">プラン</span>
              </div>
              <span className="font-semibold">
                {translatePlanType(subscriptionDetails.planType ?? "monthly")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-gray-700 font-medium">ステータス</span>
              </div>
              <span className="font-semibold">
                {translateSubscriptionStatus(subscriptionDetails.status)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-600 mr-2" />
                <span className="text-gray-700 font-medium">次回更新日</span>
              </div>
              <span className="font-semibold">
                {new Date(subscriptionDetails.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* フィードバックセクション */}
        {!hasFeedback ? (
          <div className="space-y-8 mt-6">
            <div className="flex justify-center space-x-12">
              <button className="flex flex-col items-center space-y-2 group" onClick={() => setFeedbackType("good")}>
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <ThumbsUp className="h-8 w-8 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">良かった</span>
              </button>
              <button className="flex flex-col items-center space-y-2 group" onClick={() => setFeedbackType("bad")}>
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                  <ThumbsDown className="h-8 w-8 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">改善してほしい</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {submittedFeedbackType === "good" ? (
              <div className="text-green-600 font-medium">
                フィードバックをお送りいただき、ありがとうございました。
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-4 space-y-4">
                <div className="text-gray-600 font-medium">
                  ご不便をおかけし、申し訳ございません。改善に向けて努力いたします。
                </div>
                <Button asChild variant="default" className="w-full max-w-xs bg-black hover:bg-gray-800">
                  <Link href="/contact">お問い合わせはこちら</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div className="space-y-4 pt-6">
          <Button asChild variant="outline" className="w-full max-w-xs">
            <Link href="/subscription">サブスクリプション詳細を確認</Link>
          </Button>
          <Button asChild variant="link" className="w-full max-w-xs">
            <Link href="/">ホームに戻る</Link>
          </Button>
        </div>
      </div>

      {/* フィードバックモーダル */}
      <FeedbackModal
        isOpen={!!feedbackType}
        onClose={() => setFeedbackType(null)}
        type={feedbackType || "good"}
        orderId={subscriptionId || "unknown"}
        onFeedbackSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}
