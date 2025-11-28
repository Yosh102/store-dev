// src/components/posts/SuperThanksModal.tsx
"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CreditCard, Landmark, Check, CheckCircle2, XCircle, ArrowLeft, ExternalLink, Wallet, X } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/hooks/use-toast"
import { getAuth } from "firebase/auth"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { cn } from "@/lib/utils"
import WalletComponent, { type PaymentMethod } from "@/components/store/wallet/WalletComponent"
import Image from 'next/image'

interface SuperThanksModalProps {
  isOpen: boolean
  onClose: () => void
  post: {
    id: string
    title: string
    thumbnailUrl?: string
    groupName?: string
  }
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const PRESET_AMOUNTS = [300, 500, 1000, 3000, 5000, 10000, 30000, 50000]

type PaymentStep = "amount" | "payment_method" | "wallet" | "card_payment" | "confirm" | "processing" | "success" | "bank_info" | "error"

const isPayPayEnabled = process.env.NEXT_PUBLIC_ENABLE_PAYPAY === 'true'

// CSRF トークン取得
async function getCsrfToken(): Promise<string> {
  try {
    const response = await fetch('/api/auth/csrf')
    const data = await response.json()
    if (data.success && data.token) {
      return data.token
    }
    throw new Error('Failed to get CSRF token')
  } catch (error) {
    console.error('CSRF token error:', error)
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1]
    return csrfToken || ''
  }
}

// カードブランド表示名を取得
function getCardBrandDisplayName(brand: string): string {
  const displayNames: { [key: string]: string } = {
    visa: 'VISA',
    mastercard: 'Mastercard',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    amex: 'American Express',
    diners: 'Diners Club',
    discover: 'Discover',
  }
  return displayNames[brand.toLowerCase()] || brand.toUpperCase()
}

export function SuperThanksModal({ isOpen, onClose, post }: SuperThanksModalProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState("")
  const [paymentType, setPaymentType] = useState<"card" | "bank_transfer" | "paypay">("card")
  const [message, setMessage] = useState("")
  const [step, setStep] = useState<PaymentStep>("amount")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [bankInstructionsUrl, setBankInstructionsUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // カード関連
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)

  const amount = selectedAmount || (customAmount ? parseInt(customAmount) : null)

  useEffect(() => {
    if (isOpen && user) {
      getCsrfToken().catch(console.error)
    }
  }, [isOpen, user])

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("amount")
        setSelectedAmount(null)
        setCustomAmount("")
        setMessage("")
        setClientSecret(null)
        setBankInstructionsUrl(null)
        setErrorMessage(null)
        setPaymentType("card")
        setSelectedPaymentMethod(null)
      }, 300)
    }
  }, [isOpen])

  const handleCardsLoaded = (cards: PaymentMethod[]) => {
    setPaymentMethods(cards)
    if (cards.length > 0 && !selectedPaymentMethod) {
      setSelectedPaymentMethod(cards[0].id)
    }
  }

  const handleCardSelect = (cardId: string) => {
    setSelectedPaymentMethod(cardId)
  }

  const handleClose = () => {
    if (step === "processing") return
    onClose()
  }

  const handleBack = () => {
    if (step === "payment_method") {
      setStep("amount")
    } else if (step === "wallet") {
      setStep("payment_method")
    } else if (step === "card_payment") {
      setStep("wallet")
    } else if (step === "confirm") {
      if (paymentType === "card") {
        setStep("wallet")
      } else {
        setStep("payment_method")
      }
    }
  }

  const handleAmountNext = () => {
    if (!user) {
      toast({ title: "ログインが必要です", variant: "destructive" })
      return
    }

    if (!amount || amount < 300) {
      toast({
        title: "金額を入力してください",
        description: "最低金額は300円です。",
        variant: "destructive"
      })
      return
    }

    if (amount > 300000) {
      toast({
        title: "金額が高すぎます",
        description: "一度に送れる金額は300,000円までです。",
        variant: "destructive"
      })
      return
    }

    setStep("payment_method")
  }

  const handlePaymentMethodNext = () => {
    if (paymentType === "card") {
      setStep("wallet")
    } else {
      setStep("confirm")
    }
  }

  const handleWalletNext = () => {
    if (!selectedPaymentMethod) {
      toast({
        title: "カードを選択してください",
        variant: "destructive"
      })
      return
    }
    setStep("confirm")
  }

  // ✅ 改善された確認 → 決済実行
  const handleConfirmPayment = async () => {
    console.log('=== handleConfirmPayment開始 ===')
    console.log('paymentType:', paymentType)
    console.log('selectedPaymentMethod:', selectedPaymentMethod)
    console.log('amount:', amount)
    
    setStep("processing")

    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()

      if (!token) {
        throw new Error("認証に失敗しました")
      }

      const csrfToken = await getCsrfToken()

      const superThanksItem = {
        id: `super-thanks-${post.id}`,
        name: `Special Cheer: ${post.title}`,
        price: amount,
        quantity: 1,
        requiresShipping: false,
        itemType: 'special_cheer',
        excludeTax: true,
        postId: post.id,
        postTitle: post.title,
        images: post.thumbnailUrl ? [post.thumbnailUrl] : [],
        metadata: {
          message: message || undefined,
          groupName: post.groupName
        }
      }

      if (paymentType === "paypay") {
        const response = await fetch("/api/paypay/create-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            items: [superThanksItem],
            userId: user?.uid,
            userAgent: navigator.userAgent,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "PayPay決済の作成に失敗しました")
        }

        if (data.cashierUrl) {
          window.location.href = data.cashierUrl
          return
        }
      } else if (paymentType === "bank_transfer") {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            items: [superThanksItem],
            paymentType: "bank_transfer",
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "決済の準備に失敗しました")
        }

        if (data.hostedInstructionsUrl) {
          setBankInstructionsUrl(data.hostedInstructionsUrl)
          setStep("bank_info")
        } else {
          throw new Error("振込先情報の取得に失敗しました")
        }
      } else if (paymentType === "card") {
        // ✅ カード決済
        console.log('=== カード決済開始 ===')
        
        if (!selectedPaymentMethod) {
          throw new Error("カードが選択されていません")
        }

        console.log('API リクエスト送信中...')
        
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-csrf-token": csrfToken,
          },
          body: JSON.stringify({
            items: [superThanksItem],
            paymentType: "card",
            paymentMethodId: selectedPaymentMethod,
          }),
        })

        console.log('API レスポンス受信:', response.status, response.statusText)
        
        const data = await response.json()
        console.log('レスポンスデータ:', JSON.stringify(data, null, 2))

        // ✅ より詳細なログ
        console.log('判定情報:', {
          'response.ok': response.ok,
          'data.success': data.success,
          'data.requiresAction': data.requiresAction,
          'data.clientSecret': data.clientSecret ? '存在' : '不在',
          'data.paymentIntent?.status': data.paymentIntent?.status,
          'data.paymentIntentId': data.paymentIntentId,
          'data.orderId': data.orderId,
          'data.error': data.error,
        })

        if (!response.ok) {
          console.error('API Error (response not ok):', data.error)
          throw new Error(data.error || "決済の準備に失敗しました")
        }

        // ✅ 改善された判定ロジック
        const piStatus = data.paymentIntent?.status

        // 3Dセキュアが必要な場合
        if (data.requiresAction && data.clientSecret) {
          console.log('→ 3Dセキュア認証が必要（card_paymentステップへ）')
          setClientSecret(data.clientSecret)
          setStep("card_payment")
          return
        }

        // 成功判定（複数の条件をチェック）
        if (
          data.success === true ||
          piStatus === 'succeeded' ||
          piStatus === 'processing' ||
          (data.paymentIntentId && !data.error)
        ) {
          console.log('→ 決済成功（successステップへ）')
          setStep("success")
          return
        }

        // エラーメッセージがある場合
        if (data.error) {
          console.error('API Error (data.error):', data.error)
          throw new Error(data.error)
        }

        // どの条件にも当てはまらない場合
        console.error('予期しないレスポンス状態:', {
          success: data.success,
          requiresAction: data.requiresAction,
          piStatus: piStatus,
          hasPaymentIntentId: !!data.paymentIntentId,
        })
        throw new Error(
          `決済処理が完了しませんでした。ステータス: ${piStatus || '不明'}。サポートにお問い合わせください。`
        )
      }
    } catch (error: any) {
      console.error("=== Special Cheer Error ===")
      console.error('Error type:', error.constructor.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      setErrorMessage(error.message || "エラーが発生しました")
      setStep("error")
    }
  }

  const handlePaymentSuccess = () => {
    console.log('=== handlePaymentSuccess ===')
    setStep("success")
  }

  const handlePaymentError = (error: string) => {
    console.error('=== handlePaymentError ===', error)
    setErrorMessage(error)
    setStep("error")
  }

  const handleRetry = () => {
    console.log('=== handleRetry ===')
    setStep("amount")
    setErrorMessage(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-full w-full h-screen max-h-screen p-0 gap-0 bg-white overflow-hidden border-0">
        <button
          onClick={handleClose}
          disabled={step === "processing"}
          className="fixed right-3 top-3 sm:right-4 sm:top-4 z-50 rounded-full p-2 hover:bg-gray-100 transition-colors disabled:opacity-50 bg-white/90 backdrop-blur-sm bg-gray-50"
          aria-label="閉じる"
        >
          <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
        </button>

        <div className="h-full w-full overflow-y-auto overflow-x-hidden">
          <div className="min-h-full flex flex-col">
            {/* ヘッダー */}
            <div className="flex-shrink-0 px-4 pt-16 pb-4 sm:pt-12 sm:pb-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 sm:gap-3 justify-center text-xl sm:text-2xl md:text-3xl">
                  <span className="text-2xl sm:text-3xl md:text-4xl">🎉</span>
                  Special Cheerを送る
                </DialogTitle>
              </DialogHeader>
            </div>

            {/* メインコンテンツ */}
            <div className="flex-1 px-4 pb-4 sm:px-6 md:px-8">
              <div className="max-w-2xl mx-auto">
                {/* ✅ ログインしていない場合の表示 */}
                {!user && (
                  <div className="py-8 sm:py-12 text-center space-y-4 sm:space-y-6">
                    <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-8 w-8 sm:h-10 sm:w-10 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">ログインが必要です</h3>
                      <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                        Special Cheerを送るには<br />
                        PLAY TUNE IDでログインしてください
                      </p>
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-3">
                      <Button
                        onClick={() => {
                          handleClose()
                          window.location.href = '/login'
                        }}
                        className="w-full h-12 sm:h-14 bg-black hover:bg-gray-800 text-white text-sm sm:text-base"
                      >
                        ログイン
                      </Button>
                      
                      <p className="text-xs sm:text-sm text-gray-500">
                        アカウントをお持ちでない方は
                        <button
                          onClick={() => {
                            handleClose()
                            window.location.href = '/signup'
                          }}
                          className="text-black font-semibold hover:underline ml-1"
                        >
                          新規登録
                        </button>
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 1: 金額選択 */}
                {user && step === "amount" && (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="text-center py-4 sm:py-6">
                      <p className="text-xs sm:text-sm text-gray-500 mb-2">Special Cheer</p>
                      <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-amber-500">
                        {amount ? amount.toLocaleString() : "0"}円
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm sm:text-base text-gray-700 mb-2 sm:mb-3 block font-semibold">金額を選択</Label>
                      <div className="grid grid-cols-4 gap-2 sm:gap-3">
                        {PRESET_AMOUNTS.map((preset) => (
                          <Button
                            key={preset}
                            type="button"
                            variant={selectedAmount === preset ? "default" : "outline"}
                            onClick={() => {
                              setSelectedAmount(preset)
                              setCustomAmount("")
                            }}
                            className={cn(
                              "h-12 sm:h-14 md:h-16 text-xs sm:text-sm md:text-base font-medium",
                              selectedAmount === preset && "bg-amber-500 hover:bg-amber-600"
                            )}
                          >
                            {preset}円
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="custom-amount" className="text-sm sm:text-base text-gray-700 mb-2 block font-semibold">
                        またはカスタム金額を入力
                      </Label>
                      <Input
                        id="custom-amount"
                        type="number"
                        min="300"
                        max="300000"
                        placeholder="300~300,000円まで"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value)
                          setSelectedAmount(null)
                        }}
                        className="h-12 sm:h-14 text-base sm:text-lg md:text-xl text-center"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message" className="text-sm sm:text-base text-gray-700 mb-2 block font-semibold">
                        メッセージ（任意）
                      </Label>
                      <textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="応援メッセージを添えることができます"
                        className="w-full min-h-[80px] sm:min-h-[100px] px-3 py-2 text-sm sm:text-base rounded-md border border-input bg-background resize-none"
                        maxLength={200}
                      />
                      <p className="text-xs sm:text-sm text-gray-500 text-right mt-1">
                        {message.length}/200
                      </p>
                    </div>

                    <Button
                      onClick={handleAmountNext}
                      disabled={!amount || amount < 300}
                      className="w-full h-12 sm:h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm sm:text-base md:text-lg font-medium"
                    >
                      次へ進む
                    </Button>
                  </div>
                )}

                {/* Step 2: 決済方法選択 */}
                {user && step === "payment_method" && (
                  <div className="space-y-4 sm:space-y-5">
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm sm:text-base font-medium text-black">Special Cheer</span>
                        <span className="text-2xl sm:text-3xl font-bold text-amber-500">
                          ¥{amount?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">決済方法を選択</h3>

                    <Card
                      onClick={() => setPaymentType('card')}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-lg",
                        paymentType === 'card' && "border-2 border-black"
                      )}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-center">
                        <div className="mr-3 sm:mr-4 h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full">
                          <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-medium text-sm sm:text-base truncate">クレジットカード</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">
                            {paymentMethods.length > 0
                              ? `${paymentMethods.length}枚登録済み`
                              : "Visa / Mastercard / JCB / Amex"}
                          </div>
                        </div>
                        {paymentType === 'card' && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => isPayPayEnabled && setPaymentType('paypay')}
                      className={cn(
                        "cursor-pointer transition-all",
                        !isPayPayEnabled && "opacity-50 cursor-not-allowed",
                        isPayPayEnabled && "hover:shadow-lg",
                        paymentType === 'paypay' && "border-2 border-black"
                      )}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-center">
                        <div className="mr-3 sm:mr-4 h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 flex items-center justify-center">
                          <img src="/paypay.svg" alt="PayPay" className="h-6 w-6 sm:h-8 sm:w-8" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-medium text-sm sm:text-base flex items-center gap-2">
                            <span className="truncate">PayPay</span>
                            {isPayPayEnabled && (
                              <Badge className="bg-red-500 text-white text-xs flex-shrink-0">NEW</Badge>
                            )}
                            {!isPayPayEnabled && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">無効</Badge>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">
                            {isPayPayEnabled ? 'アプリ/ブラウザで簡単決済' : '管理画面で有効化してください'}
                          </div>
                        </div>
                        {paymentType === 'paypay' && isPayPayEnabled && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card
                      onClick={() => setPaymentType('bank_transfer')}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-lg",
                        paymentType === 'bank_transfer' && "border-2 border-black"
                      )}
                    >
                      <CardContent className="p-4 sm:p-5 flex items-center">
                        <div className="mr-3 sm:mr-4 h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-full">
                          <Landmark className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="font-medium text-sm sm:text-base truncate">銀行振込</div>
                          <div className="text-xs sm:text-sm text-gray-500 truncate">ATM / ネットバンキング</div>
                        </div>
                        {paymentType === 'bank_transfer' && (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 bg-black rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="flex gap-2 sm:gap-3 pt-2">
                      <Button onClick={handleBack} variant="outline" className="flex-1 h-12 sm:h-14 text-sm sm:text-base">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                        戻る
                      </Button>
                      <Button
                        onClick={handlePaymentMethodNext}
                        className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm sm:text-base"
                      >
                        次へ進む
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Wallet */}
                {user && step === "wallet" && (
                  <div className="space-y-4 sm:space-y-5">
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm sm:text-base font-medium text-black">Special Cheer</span>
                        <span className="text-2xl sm:text-3xl font-bold text-amber-500">
                          ¥{amount?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                      <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-gray-700" />
                      <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">カードを管理</h3>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 -mt-2">カードを選択または追加してください</p>

                    <WalletComponent
                      selectionMode={true}
                      selectedCardId={selectedPaymentMethod}
                      onCardSelect={handleCardSelect}
                      onCardsLoaded={handleCardsLoaded}
                      showAddButton={true}
                    />

                    <div className="flex gap-2 sm:gap-3 pt-2">
                      <Button onClick={handleBack} variant="outline" className="flex-1 h-12 sm:h-14 text-sm sm:text-base">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                        戻る
                      </Button>
                      <Button
                        onClick={handleWalletNext}
                        disabled={!selectedPaymentMethod}
                        className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm sm:text-base"
                      >
                        確認へ進む
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: 最終確認 */}
                {user && step === "confirm" && (
                  <div className="space-y-4 sm:space-y-6">
                    <h3 className="text-xl sm:text-2xl font-bold text-center">内容の確認</h3>

                    <div className="bg-amber-50 rounded-lg p-4 sm:p-5">
                      <div className="flex justify-between items-center mb-2 sm:mb-3">
                        <span className="text-sm sm:text-base font-medium text-amber-700">Special Cheer</span>
                        <span className="text-3xl sm:text-4xl font-bold text-amber-600">
                          ¥{amount?.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600">※ 消費税込みの金額です</p>
                    </div>

                    {message && (
                      <div className="bg-gray-50 rounded-lg p-4 sm:p-5">
                        <p className="text-xs sm:text-sm text-gray-500 mb-2">メッセージ</p>
                        <p className="text-sm sm:text-base text-gray-900">{message}</p>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 sm:p-5">
                      <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3">決済方法</p>
                      {paymentType === "card" && selectedPaymentMethod ? (
                        (() => {
                          const method = paymentMethods.find(m => m.id === selectedPaymentMethod)
                          if (method) {
                            const brandName = getCardBrandDisplayName(method.card.brand)
                            return (
                              <p className="text-sm sm:text-base font-medium">
                                {brandName} **** {method.card.last4}
                              </p>
                            )
                          }
                          return null
                        })()
                      ) : paymentType === "paypay" ? (
                        <p className="text-sm sm:text-base font-medium">PayPay</p>
                      ) : (
                        <p className="text-sm sm:text-base font-medium">銀行振込</p>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 sm:p-5">
                      <p className="text-sm sm:text-base text-gray-900 font-medium mb-2 sm:mb-3">ご注意</p>
                      <ul className="text-xs sm:text-sm text-gray-800 space-y-1 sm:space-y-2">
                        <li>• Special Cheerは返金できません</li>
                        <li>• Special Cheerはタレントの活動や楽曲制作に活用されます</li>
                        {paymentType === "bank_transfer" && (
                          <li>• 銀行振込は入金確認後に反映されます</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex gap-2 sm:gap-3">
                      <Button onClick={handleBack} variant="outline" className="flex-1 h-12 sm:h-14 text-sm sm:text-base">
                        <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                        戻る
                      </Button>
                      <Button
                        onClick={handleConfirmPayment}
                        className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm sm:text-base"
                      >
                        <span className="text-lg sm:text-xl mr-1 sm:mr-2">🎉</span>
                        送信する
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step: カード決済（3Dセキュア） */}
                {user && step === "card_payment" && clientSecret && (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm
                      amount={amount!}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      onBack={handleBack}
                    />
                  </Elements>
                )}

                {/* 処理中 */}
                {step === "processing" && (
                  <div className="py-12 sm:py-16 text-center space-y-4">
                    <div className="animate-spin border-t-transparent rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-amber-500 mx-auto" />
                    <p className="text-sm sm:text-base text-gray-600 font-medium">決済を処理しています...</p>
                  </div>
                )}

                              {/* 成功 */}
                {step === "success" && (
                  <div className="py-8 sm:py-12 text-center space-y-4 sm:space-y-6">
                    {/* ✅ 記事サムネイル + 🎉マーク */}
                    <div className="relative mx-auto w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56">
                      {post.thumbnailUrl ? (
                        <>
                          {/* サムネイル画像（角丸） */}
                          <div className="w-full h-full rounded-3xl overflow-hidden bg-gray-100 shadow-lg">
                            <img
                              src={post.thumbnailUrl}
                              alt={post.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          {/* 🎉マークオーバーレイ（オレンジグラデーション） */}
                          <div className="absolute -bottom-3 -right-3 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 rounded-full flex items-center justify-center border-4 border-white shadow-xl">
                            <span className="text-3xl sm:text-4xl">🎉</span>
                          </div>
                        </>
                      ) : (
                        // サムネイルがない場合
                        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 rounded-3xl flex items-center justify-center shadow-lg">
                          <span className="text-6xl sm:text-7xl">🎉</span>
                        </div>
                      )}
                    </div>

                    {/* 成功メッセージ */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">✨</span>
                        <h3 className="text-xl sm:text-2xl font-bold">送信完了！</h3>
                        <span className="text-2xl">✨</span>
                      </div>
                      

                      {/* 金額 */}
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 max-w-md mx-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Special Cheer</span>
                          <span className="text-2xl sm:text-3xl font-bold text-amber-600">
                            {amount?.toLocaleString()}円
                          </span>
                        </div>
                      </div>

                      {/* 送信したメッセージ */}
                      {message && (
                        <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto text-left">
                          <p className="text-xs text-gray-500 mb-2">あなたのメッセージ</p>
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">{message}</p>
                        </div>
                      )}

                      <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                        Special CheerがPLAY TUNEに届きました。<br />
                        ご支援ありがとうございます！
                      </p>
                    </div>
                    
                    <Button 
                      onClick={handleClose} 
                      className="w-full max-w-md mx-auto h-12 sm:h-14 text-sm sm:text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    >
                      閉じる
                    </Button>
                  </div>
                )}

                {/* 銀行振込情報 */}
                {step === "bank_info" && (
                  <div className="py-8 sm:py-12 text-center space-y-4 sm:space-y-6">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">振込先情報</h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        以下のリンクから振込先をご確認ください
                      </p>
                    </div>
                    
                    {bankInstructionsUrl && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Button asChild variant="default" className="w-full h-12 sm:h-14 text-sm sm:text-base bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                          <a href={bankInstructionsUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            振込先を確認
                          </a>
                        </Button>
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-lg p-4 text-left">
                      <p className="text-xs sm:text-sm text-gray-900 mb-2 font-medium">入金後の処理</p>
                      <ul className="text-xs text-gray-800 space-y-1">
                        <li>• 入金確認後、Special Cheerが送信されます</li>
                        <li>• 確認には1〜3営業日かかる場合があります</li>
                        <li>• 入金状況は注文履歴からご確認いただけます</li>
                      </ul>
                    </div>
                    
                    <Button onClick={handleClose} variant="outline" className="w-full max-w-md mx-auto h-12 sm:h-14 text-sm sm:text-base">
                      閉じる
                    </Button>
                  </div>
                )}

                {/* エラー */}
                {step === "error" && (
                  <div className="py-8 sm:py-12 text-center space-y-4 sm:space-y-6">
                    <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold mb-2">エラーが発生しました</h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {errorMessage || "決済処理中にエラーが発生しました"}
                      </p>
                    </div>
                    <div className="flex gap-2 sm:gap-3 max-w-md mx-auto">
                      <Button onClick={handleClose} variant="outline" className="flex-1 h-12 sm:h-14 text-sm sm:text-base">
                        閉じる
                      </Button>
                      <Button onClick={handleRetry} className="flex-1 h-12 sm:h-14 text-sm sm:text-base">
                        もう一度試す
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// カード決済フォーム（3Dセキュア用）
function PaymentForm({
  amount,
  onSuccess,
  onError,
  onBack,
}: {
  amount: number
  onSuccess: () => void
  onError: (error: string) => void
  onBack: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) return

    setIsProcessing(true)

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/success`,
        },
        redirect: "if_required",
      })

      if (error) {
        throw new Error(error.message || "決済に失敗しました")
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        onSuccess()
      }
    } catch (err: any) {
      console.error("Payment error:", err)
      onError(err.message || "決済に失敗しました")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-5">
        <div className="flex justify-between items-center">
          <span className="text-sm sm:text-base font-medium text-gray-700">支払い金額</span>
          <span className="text-2xl sm:text-3xl font-bold text-amber-600">
            ¥{amount.toLocaleString()}
          </span>
        </div>
      </div>

      <div>
        <Label className="text-sm sm:text-base font-medium mb-2 block">カード情報</Label>
        <div className="border rounded-lg p-3 bg-white">
          <PaymentElement />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 text-xs sm:text-sm text-gray-600 space-y-1">
        <p>• Special Cheerは返金できません</p>
        <p>• 決済完了後、クリエイターに送信されます</p>
        <p>• カード情報は安全に暗号化されます</p>
      </div>

      <div className="flex gap-2 sm:gap-3">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="flex-1 h-12 sm:h-14 text-sm sm:text-base"
          disabled={isProcessing}
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
          戻る
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 h-12 sm:h-14 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-sm sm:text-base"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              処理中...
            </>
          ) : (
            <>
              <span className="text-lg sm:text-xl mr-1 sm:mr-2">🎉</span>
              {amount.toLocaleString()}円を送信
            </>
          )}
        </Button>
      </div>
    </form>
  )
}