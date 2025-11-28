"use client"

import { useState } from "react"
import { X, ThumbsUp, ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedbackModal } from "@/components/store/FeedbackModal"
import Link from "next/link"
import Image from "next/image"

interface OrderSuccessContentProps {
  orderId: string
}

export default function OrderSuccessContent({ orderId }: OrderSuccessContentProps) {
  const [feedbackType, setFeedbackType] = useState<"good" | "bad" | null>(null)
  const [hasFeedback, setHasFeedback] = useState(false)
  const [submittedFeedbackType, setSubmittedFeedbackType] = useState<"good" | "bad" | null>(null)

  const handleFeedbackSubmit = (type: "good" | "bad") => {
    setHasFeedback(true)
    setSubmittedFeedbackType(type)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center p-4">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Link href="/">
            <X className="h-6 w-6" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm">
          ヘルプ
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        {/* Illustration */}
        <div className="relative my-8">
          <Image
            src="/img/shopping_bag.png"
            alt="Order Success"
            width={200}
            height={200}
            className="object-contain mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold">ご注文ありがとうございます</h1>
        <p className="text-gray-600">
          PLAYTUNE STOREをご利用いただき、ありがとうございます。
          {!hasFeedback && " 今回のお買い物についてご感想をお聞かせください。"}
        </p>

        {/* Feedback Section */}
        {!hasFeedback ? (
          <div className="space-y-8">
            {/* Feedback Buttons */}
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
          <div className="space-y-4">
            {submittedFeedbackType === "good" ? (
              <div className="text-green-600 font-medium">フィードバックをお送りいただき、ありがとうございました。</div>
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

        {/* Order List Button and Home Link */}
        <div className="space-y-4 pt-4">
          <Button asChild variant="outline" className="w-full max-w-xs">
            <Link href="/orders">注文履歴を確認する</Link>
          </Button>
          <Button asChild variant="link" className="w-full max-w-xs">
            <Link href="/">ホームに戻る</Link>
          </Button>
        </div>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={!!feedbackType}
        onClose={() => setFeedbackType(null)}
        type={feedbackType || "good"}
        orderId={orderId}
        onFeedbackSubmit={handleFeedbackSubmit}
      />
    </div>
  )
}
