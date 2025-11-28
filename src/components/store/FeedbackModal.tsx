"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Star } from "lucide-react"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  type: "good" | "bad"
  orderId: string
  onFeedbackSubmit: (type: "good" | "bad") => void
}

export function FeedbackModal({ isOpen, onClose, type, orderId, onFeedbackSubmit }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("")
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast({
        title: "エラー",
        description: "評価を選択してください。",
        variant: "destructive",
      })
      return
    }

    if (type === "bad" && !feedback.trim()) {
      toast({
        title: "エラー",
        description: "フィードバックを入力してください。",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      await addDoc(collection(db, "feedback"), {
        orderId,
        type,
        rating,
        feedback: feedback.trim() || null,
        createdAt: new Date(),
      })

      toast({
        title: "送信完了",
        description: "フィードバックをお送りいただき、ありがとうございます。",
      })
      onFeedbackSubmit(type)
      onClose()
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast({
        title: "エラー",
        description: "フィードバックの送信に失敗しました。",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {type === "good" ? "ご満足いただき、ありがとうございます" : "ご不便をおかけし、申し訳ございません"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className="focus:outline-none"
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(value)}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    value <= (hoveredRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <Textarea
            placeholder={
              type === "good"
                ? "よろしければ、ご感想をお聞かせください（任意）"
                : "改善点などございましたら、ご意見をお聞かせください"
            }
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="min-h-[100px]"
            required={type === "bad"}
          />
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "送信中..." : "送信"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

