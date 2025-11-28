// /src/components/store/SubscriptionPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/auth-context'
import { Group } from '@/types/group'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Check, CreditCard, Plus, ExternalLink, X } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import CardSetupForm from '@/components/store/wallet/CardSetupForm'
import { config } from '@/lib/config'
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { User } from '@/types/user'
import { Timestamp } from "firebase/firestore"
import { detectErrorCode, logError, type ErrorCode } from '@/lib/error-codes'
import Link from 'next/link'

interface SubscriptionPanelProps {
  group: Group
  onClose: () => void
}

interface StripePaymentMethod {
  id: string
  card: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
}

interface CurrentSubscription {
  planType: 'monthly' | 'yearly'
  status: string
  currentPeriodEnd: Timestamp
}

const stripePromise = loadStripe(config.stripe.publishableKey!)

// CSRFトークン取得
async function fetchCSRFToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
  })
  const data = await response.json()
  return data.token
}

// Skeleton Component
function PaymentMethodSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 sm:p-4 bg-white">
            <div className="flex items-center">
              <div className="mr-3 h-5 w-5 bg-gray-200 rounded animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
    </div>
  )
}

export default function SubscriptionPanel({ group, onClose }: SubscriptionPanelProps) {
  const { user, getIdToken } = useAuth() as { user: User | null; getIdToken: () => Promise<string> }

  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null)
  const [billingType, setBillingType] = useState<'monthly' | 'yearly'>('monthly')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)
  const [loading, setLoading] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<StripePaymentMethod[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [stripeCustomerId, setStripeCustomerId] = useState('')
  const [checkingSubscription, setCheckingSubscription] = useState(true)
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true)

  useEffect(() => {
    if (!user) return
    fetchStripeCustomer()
  }, [user])

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !user.subscriptions) {
        setCheckingSubscription(false)
        return
      }
      const subscription = user.subscriptions[group.id]
      if (subscription && subscription.status === 'active') {
        setCurrentSubscription({
          planType: subscription.planType,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        })
      }
      setCheckingSubscription(false)
    }
    checkSubscription()
  }, [user, group.id])

  const fetchStripeCustomer = async () => {
    if (!user) return
    setLoadingPaymentMethods(true)
    try {
      const idToken = await getIdToken()
      const csrfToken = await fetchCSRFToken()
      const res = await fetch('/api/stripe/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setStripeCustomerId(data.customer.id)
      await fetchPaymentMethods(data.customer.id)
    } catch (e: any) {
      console.error('fetchStripeCustomer error:', e)
      const code = detectErrorCode(e)
      setErrorCode(code)
      await logError(code, {
        userId: user?.uid,
        action: 'fetchStripeCustomer',
        details: { error: e.message }
      })
      setLoadingPaymentMethods(false)
    }
  }

  const fetchPaymentMethods = async (customerId: string) => {
    setLoadingPaymentMethods(true)
    try {
      const idToken = await getIdToken()
      const res = await fetch(`/api/stripe/payment-methods?customerId=${customerId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` },
      })
      if (!res.ok) throw new Error('Failed to fetch payment methods')
      const data = await res.json()
      setPaymentMethods(data.paymentMethods || [])
      if (data.paymentMethods && data.paymentMethods.length && !selectedPaymentMethod) {
        setSelectedPaymentMethod(data.paymentMethods[0].id)
      }
    } catch (e) {
      console.error('fetchPaymentMethods error:', e)
      setPaymentMethods([])
    } finally {
      setLoadingPaymentMethods(false)
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!stripeCustomerId) {
      const code: ErrorCode = 'SUB-C-002'
      setErrorCode(code)
      await logError(code, {
        userId: user?.uid,
        action: 'handleAddPaymentMethod',
        details: { reason: 'No customer ID' }
      })
      return
    }
    try {
      const idToken = await getIdToken()
      const res = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ customerId: stripeCustomerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SetupIntent creation failed')
      setClientSecret(data.clientSecret)
      setShowAddCard(true)
    } catch (e: any) {
      const code = detectErrorCode(e)
      setErrorCode(code)
      await logError(code, {
        userId: user?.uid,
        action: 'handleAddPaymentMethod',
        details: { error: e.message }
      })
    }
  }

  const handleSetupSuccess = () => {
    setClientSecret(null)
    setShowAddCard(false)
    fetchPaymentMethods(stripeCustomerId)
  }

  const handleSubscribe = async () => {
    if (currentSubscription) {
      setErrorCode('SUB-S-003')
      return
    }
    if (!user) {
      setErrorCode('AUTH-001')
      return
    }
    if (!selectedPaymentMethod) {
      setErrorCode('SUB-S-004')
      return
    }
    if (!stripeCustomerId) {
      setErrorCode('SUB-C-002')
      return
    }

    setLoading(true)
    setErrorCode(null)

    const selectedPriceId = group.subscriptionPlans[billingType].priceId
    if (!selectedPriceId) {
      setErrorCode('SUB-S-001')
      setLoading(false)
      return
    }

    // ✅ 成功フラグと結果を保存
    let subscriptionCreated = false
    let subscriptionId = ''

    try {
      const idToken = await getIdToken()
      const csrfToken = await fetchCSRFToken()

      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          groupId: group.id,
          planType: billingType,
          priceId: selectedPriceId,
          paymentMethodId: selectedPaymentMethod,
          customerId: stripeCustomerId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // ✅ サーバーエラー：エラーコードを設定して処理終了
        console.error('Subscription creation failed:', data)
        if (data.error) {
          setErrorCode(data.error as ErrorCode)
        } else {
          throw new Error(data.message || 'Subscription creation failed')
        }
        setLoading(false)
        return
      }

      // ✅ レスポンスの検証
      if (!data.success || !data.subscriptionId) {
        console.error('Invalid response from server:', data)
        setErrorCode('SUB-S-002')
        await logError('SUB-S-002', {
          userId: user?.uid,
          action: 'handleSubscribe',
          details: { reason: 'Invalid response structure', data }
        })
        setLoading(false)
        return
      }

      // ✅ 成功フラグを立てる
      subscriptionCreated = true
      subscriptionId = data.subscriptionId
      console.log('Subscription created successfully:', subscriptionId)

    } catch (e: any) {
      console.error('Subscription creation error:', e)
      const code = detectErrorCode(e)
      setErrorCode(code)
      await logError(code, {
        userId: user?.uid,
        action: 'handleSubscribe',
        details: { error: e.message, stack: e.stack }
      })
      setLoading(false)
      return
    }

    // ✅ 成功した場合のみ遷移
    if (subscriptionCreated && subscriptionId) {
      console.log('Redirecting to success page...')
      onClose()
      window.location.href = `/subscription/success?subscription_id=${subscriptionId}`
    } else {
      // ✅ 予期しない状態：エラー表示
      console.error('Unexpected state: subscription not created')
      setErrorCode('SUB-S-002')
      setLoading(false)
    }
  }

  const handleLoginSignup = (action: 'login' | 'signup') => {
    onClose()
    window.location.href = `/${action}`
  }

  const monthlyAmount = group.subscriptionPlans.monthly.amount
  const yearlyAmount = group.subscriptionPlans.yearly.amount
  const yearlyMonthlyAmount = Math.floor(yearlyAmount / 12)
  const savingsPercentage = Math.floor(((monthlyAmount * 12 - yearlyAmount) / (monthlyAmount * 12)) * 100)

  let content: React.ReactNode

  if (checkingSubscription) {
    content = (
      <div className="p-6">
        <DialogHeader>
          <DialogTitle>{group.name} メンバーシップ</DialogTitle>
          <DialogDescription>メンバーシップ情報を確認中...</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </div>
    )
  } else if (currentSubscription) {
    content = (
      <div className="p-6">
        <DialogHeader>
          <DialogTitle>{group.name} メンバーシップ</DialogTitle>
          <DialogDescription>あなたは既にこのグループのメンバーシップに登録されています。</DialogDescription>
        </DialogHeader>

        <Card className="bg-gray-50 p-6 mb-6">
          <div className="mb-4">
            <div className="flex items-baseline justify-center mb-1">
              <span className="text-2xl font-semibold">¥</span>
              <span className="text-5xl font-bold">
                {currentSubscription.planType === 'monthly'
                  ? group.subscriptionPlans.monthly.amount.toLocaleString()
                  : Math.floor(group.subscriptionPlans.yearly.amount / 12).toLocaleString()}
              </span>
              <span className="text-secondary-foreground ml-2">/ 月</span>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {currentSubscription.planType === 'monthly'
                ? `月額 ¥${group.subscriptionPlans.monthly.amount.toLocaleString()}`
                : `年額 ¥${group.subscriptionPlans.yearly.amount.toLocaleString()}`
              }
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-500" />
              <span>現在のプラン: {currentSubscription.planType === 'monthly' ? '月額' : '年額'}</span>
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-500" />
              <span>ステータス: {currentSubscription.status}</span>
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-green-500" />
              <span>次回更新日: {currentSubscription.currentPeriodEnd.toDate().toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        <Button
          onClick={onClose}
          className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:from-emerald-600 hover:to-sky-600"
        >
          閉じる
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="p-6">
        <DialogHeader className="pb-2">
          <DialogTitle>{group.name} メンバーシップ</DialogTitle>
          <DialogDescription>ファンクラブに参加して特別なコンテンツにアクセスしましょう。</DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="flex flex-col h-full">
            <div className="overflow-y-auto pr-1 -mr-1 max-h-[60vh]">
              <div className="space-y-4 pb-4">
                <div className="flex justify-center w-full mb-4">
                  <div className="relative inline-flex bg-gray-50 rounded-full p-1">
                    <button
                      className={cn(
                        "px-4 py-1 text-sm font-medium rounded-full transition-colors",
                        billingType === 'monthly'
                          ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white"
                          : "hover:text-primary"
                      )}
                      onClick={() => setBillingType('monthly')}
                    >
                      月額プラン
                    </button>
                    <button
                      className={cn(
                        "relative px-4 py-1 text-sm font-medium rounded-full transition-colors",
                        billingType === 'yearly'
                          ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white"
                          : "hover:text-primary"
                      )}
                      onClick={() => setBillingType('yearly')}
                    >
                      年額プラン
                      <span className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] px-1 rounded">
                        {savingsPercentage}%お得
                      </span>
                    </button>
                  </div>
                </div>

                <Card className="bg-gray-50 p-4 sm:p-6 mb-4">
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center mb-1">
                      <span className="text-xl sm:text-2xl font-semibold">¥</span>
                      <span className="text-4xl sm:text-5xl font-bold">
                        {(billingType === 'monthly' ? monthlyAmount : yearlyMonthlyAmount).toLocaleString()}
                      </span>
                      <span className="text-secondary-foreground ml-2">/ 月</span>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      {billingType === 'monthly'
                        ? `月額 ¥${monthlyAmount.toLocaleString()}`
                        : `年額 ¥${yearlyAmount.toLocaleString()}`
                      }
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                    <div className="flex items-center">
                      <Check className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                      <span>メンバー限定コンテンツへのアクセス</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                      <span>限定グッズの先行予約</span>
                    </div>
                    <div className="flex items-center">
                      <Check className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
                      <span>その他限定サービス</span>
                    </div>
                  </div>
                </Card>

                <div className="space-y-3 mb-4">
                  <h3 className="text-base sm:text-lg font-semibold">決済方法</h3>
                  {loadingPaymentMethods ? (
                    <PaymentMethodSkeleton />
                  ) : (
                    <>
                      {paymentMethods.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">
                          登録されている決済方法がありません。<br />
                          新しい決済方法を追加してください。
                        </div>
                      ) : (
                        paymentMethods.map((method) => (
                          <div
                            key={method.id}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                            className={`cursor-pointer transition-all duration-200 rounded-lg overflow-hidden ${
                              selectedPaymentMethod === method.id
                                ? 'border-2 border-primary'
                                : 'border border-gray-200 hover:border-gray-300'
                            }`}
                            role="radio"
                            aria-checked={selectedPaymentMethod === method.id}
                            tabIndex={0}
                          >
                            <div className={`p-3 sm:p-4 ${selectedPaymentMethod === method.id ? 'bg-gray-50' : 'bg-white'}`}>
                              <div className="flex items-center">
                                <CreditCard className="mr-3 flex-shrink-0" />
                                <div>
                                  <div className="font-medium text-sm sm:text-base">
                                    {method.card.brand.toUpperCase()} **** {method.card.last4}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    有効期限: {method.card.exp_month}/{method.card.exp_year}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <Button
                        onClick={handleAddPaymentMethod}
                        variant="outline"
                        className="w-full border-dashed border-2 text-sm sm:text-base"
                        disabled={loadingPaymentMethods}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        新しい決済方法を追加
                      </Button>
                    </>
                  )}
                </div>

                {errorCode && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>エラーが発生しました</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <div>
                        <p className="font-mono font-bold">エラーコード: {errorCode}</p>
                      </div>
                      <div className="pt-2">
                        <Link
                          href={`/contact?error=${errorCode}&source=subscription`}
                          className="inline-flex items-center gap-2 text-sm font-medium underline hover:no-underline"
                        >
                          お問い合わせページへ
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="pt-4 border-t mt-auto">
              <Button
                onClick={handleSubscribe}
                className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:from-emerald-600 hover:to-sky-600"
                disabled={loading || !selectedPaymentMethod || !!errorCode}
                size="lg"
              >
                {loading ? 'Processing...' : 'メンバーシップを開始する'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <p className="text-center">メンバーシップに参加するにはログインが必要です。</p>
            <Button onClick={() => handleLoginSignup('login')} className="w-full">PLAY TUNE IDへログイン</Button>
            <Button onClick={() => handleLoginSignup('signup')} className="w-full">PLAY TUNE IDの新規登録</Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Dialog open={true} onOpenChange={onClose}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 z-50 bg-white" />
          <DialogContent
            className="
              fixed inset-0 z-50 !translate-x-0 !translate-y-0 !left-0 !top-0
              h-screen w-screen max-w-none rounded-none border-0 p-0 bg-white
              focus:outline-none
            "
          >
            <DialogClose
              className="
                absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center
                rounded-full bg-gray-100 hover:bg-gray-200 text-black
                transition
              "
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </DialogClose>

            <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-[480px]">
                {content}
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {showAddCard && clientSecret && (
        <Dialog open={true} onOpenChange={() => setShowAddCard(false)}>
          <DialogPortal>
            <DialogOverlay className="fixed inset-0 z-[60] bg-black/60" />
            <DialogContent className="fixed left-[50%] top-[50%] z-[60] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-2rem)] max-w-[425px] bg-white rounded-xl shadow-xl p-0 border-0">
              <div className="p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>カード情報を入力</DialogTitle>
                </DialogHeader>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CardSetupForm onSetupSuccess={handleSetupSuccess} clientSecret={clientSecret} />
                </Elements>
              </div>
              <DialogClose
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 hover:bg-white text-black border border-black/10 shadow-none"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </DialogClose>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </>
  )
}