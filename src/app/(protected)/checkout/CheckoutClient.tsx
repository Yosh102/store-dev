// components/store/checkout/CheckoutClient.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import {
  CreditCard, Plus, Truck, Landmark, Tag, Minus, Trash2,
  ChevronLeft, ChevronRight, MapPin, AlertCircle, AlertTriangle,
  ShoppingCart, Check, BadgeJapaneseYen
} from 'lucide-react'
import { useCart, CartItem } from '@/lib/CartContext'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import CardSetupForm from '@/components/store/wallet/CardSetupForm'
import AddressSelection from '@/components/store/wallet/AddressSelection'
import { config } from '@/lib/config'
import { AddressDetails } from '@/types/address'
import Script from 'next/script'

/* ------------------------------------------------------------------ */
/* 環境・Stripe */
const isDevelopment = process.env.NODE_ENV === 'development'
const stripePromise = loadStripe(config.stripe.publishableKey!)

const debugLog = (...args: any[]) => { if (isDevelopment) console.log(...args) }
const debugError = (...args: any[]) => { if (isDevelopment) console.error(...args) }

/* ------------------------------------------------------------------ */
/* 型など */
type PaymentType = 'card' | 'bank_transfer' | 'paypay' | 'paidy' | 'jamm'
type CheckoutStep = 1 | 2 | 3 | 4

interface StripePaymentMethod {
  id: string
  card: { brand: string; last4: string; exp_month: number; exp_year: number }
}

/* ------------------------------------------------------------------ */
/* ✅ CSRF トークン取得関数 */
async function getCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to get CSRF token')
    }

    const data = await response.json()
    return data.token
  } catch (error) {
    console.error('Error getting CSRF token:', error)
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* コンポーネント本体 */
export default function MultiStepCheckout() {
  const { items, clearCart, getSubtotal, getShippingFee, updateQuantity, removeItem, needsShipping } = useCart()
  const { user, getIdToken } = useAuth()
  const router = useRouter()

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1)
  const [paymentType, setPaymentType] = useState<PaymentType>('card')
  const [paymentMethods, setPaymentMethods] = useState<StripePaymentMethod[]>([])
  const [selectedCardId, setSelectedCardId] = useState('')
  const [selectedAddress, setSelectedAddress] = useState<AddressDetails | null>(null)
  const [stripeCustomerId, setStripeCustomerId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [agreesToTerms, setAgreesToTerms] = useState(false)

  const [isPayPayEnabled, setIsPayPayEnabled] = useState(false)

  const [showAddCard, setShowAddCard] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  /* ───────── 税率・送料 ───────── */
  const TAX_RATE = 0.1 // 10%消費税
  const SHIPPING_FEE = 800 // 送料（一律800円・税込）

  /* ───────── 金額計算 ───────── */
  const subtotalExcludingTax = getSubtotal() // 商品小計（税抜）
  const taxAmount = Math.round(subtotalExcludingTax * TAX_RATE) // 消費税額
  const subtotalIncludingTax = subtotalExcludingTax + taxAmount // 商品小計（税込）

  // 以降で使いやすいように、税込小計を subtotal として扱う
  const subtotal = subtotalIncludingTax

  const hasShipping = needsShipping()
  const maxSteps = hasShipping ? 4 : 3

  // 送料計算
  const displayedShipping = hasShipping ? SHIPPING_FEE : 0
  const effectiveTotal = subtotalIncludingTax + displayedShipping

  /* ───────── カート構成ヘルパー ───────── */
  const formatSelectedOptions = (selectedOptions?: any[]) => {
    if (!selectedOptions || selectedOptions.length === 0) return null
    return selectedOptions.map(opt => `${opt.optionName}: ${opt.valueName}`).join(', ')
  }

  const getBasePrice = (item: any) => {
    if (!item.selectedOptions || item.selectedOptions.length === 0) return item.price
    const optionPrice = item.selectedOptions.reduce((sum: number, o: any) => sum + (o.priceModifier || 0), 0)
    return item.price - optionPrice
  }

  const calculateTax = (price: number) => Math.round(price * TAX_RATE)
  const getTaxIncludedPrice = (price: number) => price + calculateTax(price)

  const getUniqueItemKey = (item: CartItem): string => {
    const optionsKey = item.selectedOptions
      ? item.selectedOptions
        .sort((a, b) => a.optionId.localeCompare(b.optionId))
        .map(opt => `${opt.optionId}:${opt.valueId}`)
        .join('|')
      : ''
    return `${item.id}${optionsKey ? `_${optionsKey}` : ''}`
  }

  const handleQuantityChange = (uniqueKey: string, newQuantity: number) => {
    if (newQuantity > 0) updateQuantity(uniqueKey, newQuantity)
  }
  const handleRemoveItem = (uniqueKey: string) => removeItem(uniqueKey)

  /* ───────── ✅ 認証 + CSRF付き fetch ヘルパー ───────── */
  const fetchWithAuth = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      try {
        // Firebase認証トークンを取得
        const token = await getIdToken()
        if (!token) throw new Error('auth_required')

        // ✅ CSRFトークンを取得
        const csrfToken = await getCSRFToken()

        const headers = new Headers(init.headers || {})
        headers.set('Authorization', `Bearer ${token}`)

        // ✅ CSRFトークンをヘッダーに追加
        headers.set('X-CSRF-Token', csrfToken)

        if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
          headers.set('Content-Type', 'application/json')
        }

        return fetch(input, {
          ...init,
          headers,
          credentials: 'include' // ✅ クッキーも送信
        })
      } catch (e) {
        throw new Error('認証が必要です。ログインし直してください。')
      }
    },
    [getIdToken]
  )

  /* ───────── 初期化 ───────── */
  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    ;(async () => {
      await fetchStripeCustomer()
    })()
    const enabled =
      (process.env.NEXT_PUBLIC_ENABLE_PAYPAY || process.env.ENABLE_PAYPAY) === 'true'
    setIsPayPayEnabled(Boolean(enabled))
  }, [user, router])

  const fetchStripeCustomer = async () => {
    if (!user) return
    try {
      const res = await fetchWithAuth('/api/stripe/customer', {
        method: 'POST',
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      })
      if (!res.ok) throw new Error(await res.text())
      const { customer } = await res.json()
      setStripeCustomerId(customer.id)
      fetchPaymentMethods(customer.id)
    } catch (err) {
      debugError('Stripe customer fetch error:', err)
    }
  }

  const fetchPaymentMethods = async (customerId: string) => {
    try {
      const res = await fetchWithAuth(`/api/stripe/payment-methods?customerId=${customerId}`)
      if (!res.ok) throw new Error(await res.text())
      const { paymentMethods } = await res.json()
      setPaymentMethods(paymentMethods)
      if (paymentMethods.length && !selectedCardId) setSelectedCardId(paymentMethods[0].id)
    } catch (err) {
      debugError('PaymentMethods fetch error:', err)
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!stripeCustomerId) return
    try {
      const res = await fetchWithAuth('/api/stripe/setup-intent', {
        method: 'POST',
        body: JSON.stringify({ customerId: stripeCustomerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setClientSecret(data.clientSecret)
      setShowAddCard(true)
    } catch (err) {
      alert(`決済方法の追加に失敗しました: ${err}`)
    }
  }

  const handleSetupSuccess = () => {
    setShowAddCard(false)
    setClientSecret(null)
    fetchPaymentMethods(stripeCustomerId)
  }

  const handleAddressSelect = useCallback((addr: AddressDetails) => {
    setSelectedAddress(addr)
  }, [])

  /* ───────── ステップナビ ───────── */
  const getStepTitle = (step: CheckoutStep) => {
    if (!hasShipping) {
      switch (step) {
        case 1: return '決済方法'
        case 2: return '注意事項'
        case 3: return '最終確認'
        default: return ''
      }
    } else {
      switch (step) {
        case 1: return '決済方法'
        case 2: return 'お届け先'
        case 3: return '注意事項'
        case 4: return '最終確認'
        default: return ''
      }
    }
  }

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        if (paymentType === 'card') return !!selectedCardId
        if (paymentType === 'paypay') return isPayPayEnabled
        if (paymentType === 'paidy') return true
        if (paymentType === 'jamm') return true
        return true
      case 2:
        return hasShipping ? !!selectedAddress : true
      case 3:
        return agreesToTerms
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (canProceedToNext() && currentStep < maxSteps) {
      setCurrentStep((p) => (p + 1) as CheckoutStep)
      setErrorMessage(null)
    } else {
      if (currentStep === 1) {
        if (paymentType === 'card' && !selectedCardId) setErrorMessage('カード決済を選択してください。')
        else if (paymentType === 'paypay' && !isPayPayEnabled) setErrorMessage('PayPay決済は現在ご利用いただけません。')
      } else if (currentStep === 2 && hasShipping && !selectedAddress) {
        setErrorMessage('お届け先を選択してください。')
      } else if (currentStep === 3 && !agreesToTerms) {
        setErrorMessage('注意事項に同意してください。')
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((p) => (p - 1) as CheckoutStep)
      setErrorMessage(null)
    }
  }

  /* ───────── Paidy フロー ───────── */
  const startPaidyFlow = useCallback(async () => {
    console.log('[startPaidyFlow] called')

    return new Promise<void>((resolve, reject) => {
      const paidyGlobal = (window as any).Paidy
      if (!paidyGlobal || !paidyGlobal.configure) {
        console.error('[startPaidyFlow] Paidy SDK not loaded')
        reject(new Error('Paidy SDKが読み込まれていません'))
        return
      }

      let finished = false
      let paymentId: string | null = null

      const paidy = paidyGlobal.configure({
        api_key: process.env.NEXT_PUBLIC_PAIDY_PUBLIC_KEY,

        closed: function (info: any) {
          console.log('[Paidy.closed] FIRED - called with info =', info, 'finished =', finished)

          if (finished) {
            console.log('[Paidy.closed] already finished -> ignore')
            return
          }

          const normalizedStatus =
            typeof info?.status === 'string' ? info.status.toLowerCase() : ''

          if (info && typeof info === 'object' && info.id && normalizedStatus === 'authorized') {
            console.log('[Paidy.closed] treating as success, paymentId =', info.id)
            finished = true
            paymentId = info.id

            ;(async () => {
              try {
                console.log('[Paidy.closed] creating order...')
                const orderRes = await fetchWithAuth('/api/paidy/create', {
                  method: 'POST',
                  body: JSON.stringify({
                    paymentId: info.id,
                    items: items.map((i) => ({
                      id: i.id,
                      name: i.name,
                      price: i.price,
                      quantity: i.quantity,
                      requiresShipping: i.requiresShipping,
                      selectedOptions: i.selectedOptions || [],
                    })),
                    shippingFee: displayedShipping,
                    shippingInfo: hasShipping ? selectedAddress || null : null,
                  }),
                })
                const orderData = await orderRes.json()
                console.log('[Paidy.closed] order created:', orderRes.status, orderData)
              } catch (err) {
                console.error('[Paidy.closed] order creation failed:', err)
              }
            })()

            clearCart()
            console.log('[Paidy.closed] cart cleared, redirecting to success')
            router.push(`/order/success?orderId=${paymentId}&type=paidy&status=pending`)
            resolve()
            return
          }

          console.log('[Paidy.closed] user cancelled or not authorized, info.status =', info?.status)
          reject(new Error('ユーザーがPaidyを完了しませんでした'))
        },

        completed: function (paidyResult: any) {
          console.log('[Paidy.completed] FIRED - fired with result =', paidyResult)

          if (finished) {
            console.log('[Paidy.completed] already finished -> ignore')
            return
          }

          finished = true

          const completedPaymentId = paidyResult?.id as string
          console.log('[Paidy.completed] paymentId =', completedPaymentId)

          if (!completedPaymentId) {
            console.error('[Paidy.completed] No payment ID')
            reject(new Error('Paidyの Payment ID を取得できませんでした'))
            return
          }

          paymentId = completedPaymentId

          ;(async () => {
            try {
              console.log('[Paidy.completed] creating order...')
              const orderRes = await fetchWithAuth('/api/paidy/create', {
                method: 'POST',
                body: JSON.stringify({
                  paymentId: completedPaymentId,
                  items: items.map((i) => ({
                    id: i.id,
                    name: i.name,
                    price: i.price,
                    quantity: i.quantity,
                    requiresShipping: i.requiresShipping,
                    selectedOptions: i.selectedOptions || [],
                  })),
                  shippingFee: displayedShipping,
                  shippingInfo: hasShipping ? selectedAddress || null : null,
                }),
              })
              const orderData = await orderRes.json()
              console.log('[Paidy.completed] order created:', orderRes.status, orderData)
            } catch (err) {
              console.error('[Paidy.completed] order creation failed:', err)
            }
          })()

          clearCart()
          console.log('[Paidy.completed] cart cleared, redirecting to success')
          router.push(`/order/success?orderId=${paymentId}&type=paidy&status=pending`)
          resolve()
        },
      })

      // いまのカート状態から金額を再計算
      const orderAmount = subtotalExcludingTax
      const tax = taxAmount
      const shipping = hasShipping ? displayedShipping : 0
      const amount = orderAmount + tax + shipping

      // 本番環境とテスト環境で buyer 情報を切り替え
      const isProduction = process.env.NODE_ENV === 'production'

      const buyerInfo = isProduction ? {
        name1: selectedAddress?.name || 'ゲスト',
        name2: selectedAddress?.nameKana || '',
        email: user?.email || '',
        phone: selectedAddress?.phoneNumber || '',
        dob: '',
      } : {
        name1: '山田 太郎',
        name2: 'ヤマダ タロウ',
        email: 'successful.payment@paidy.com',
        phone: '08000000001',
        dob: '1990-10-25',
      }

      const payload = {
        amount,
        currency: 'JPY',
        store_name: 'PLAYTUNE',
        description: 'PLAYTUNE STORE order checkout',

        buyer: buyerInfo,

        // ✅ メタデータにFirebase User IDを追加
        metadata: {
          firebase_uid: user?.uid || '', // ✅ Firebase User ID
          order_source: 'web',
          environment: isProduction ? 'production' : 'development',
        },

        order: {
          items: items.map((i) => ({
            id: String(i.id),
            title: String(i.name),
            quantity: Number(i.quantity),
            unit_price: Number(i.price),
            description: '',
          })),
          order_ref: `web-${Date.now()}`,
          shipping: Number(shipping),
          tax: Number(tax),
          // ✅ orderレベルでもFirebase UIDを記録
          metadata: {
            firebase_uid: user?.uid || '',
          },
        },

        shipping_address: isProduction ? {
          line1: selectedAddress?.line1 || '',
          line2: selectedAddress?.line2 || '',
          city: selectedAddress?.city || '',
          state: selectedAddress?.prefecture || '',
          zip: selectedAddress?.postalCode?.replace('-', '') || '',
        } : {
          line1: 'テスト1-1-1',
          line2: '',
          city: 'テスト市',
          state: 'テスト都道府県',
          zip: '1234567',
        },
      }

      const timeoutId = setTimeout(() => {
        console.error('[Paidy] ⚠️  TIMEOUT: callbacks did not fire within 30 seconds!')
        console.log('[Paidy] finished flag =', finished, 'paymentId =', paymentId)
      }, 30000)

      const originalResolve = resolve
      const originalReject = reject

      resolve = ((value: void) => {
        clearTimeout(timeoutId)
        originalResolve(value)
      }) as any

      reject = ((reason: any) => {
        clearTimeout(timeoutId)
        originalReject(reason)
      }) as any

      paidy.launch(payload)
    })
  }, [
    user,
    items,
    subtotalExcludingTax,
    taxAmount,
    displayedShipping,
    selectedAddress,
    hasShipping,
    clearCart,
    router,
    fetchWithAuth
  ])

  /* ───────── 注文確定（Stripe/PayPay/Paidy/Jamm） ───────── */
  const handleCheckout = async () => {
    setErrorMessage(null)

    // ── Paidy
    if (paymentType === 'paidy') {
      try {
        await startPaidyFlow()
      } catch (err: any) {
        debugError('[Checkout] Paidy error:', err)
        setErrorMessage(err.message ?? 'Paidy決済でエラーが発生しました。')
      }
      return
    }

    // ── Jamm ─────────────────────────────
    if (paymentType === 'jamm') {
      try {
        if (!user) {
          throw new Error('ログインが必要です。')
        }

        // 配送がある商品で住所未選択なら弾く
        if (hasShipping && !selectedAddress) {
          throw new Error('配送先住所を選択してください。')
        }

        const origin =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_BASE_URL || 'https://store.playtune.jp'

        const res = await fetchWithAuth('/api/jamm/create-session', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              requiresShipping: i.requiresShipping,
              selectedOptions: i.selectedOptions || [],
            })),
            address: hasShipping ? selectedAddress || null : null,
            successUrl: `${origin}/order/jamm/success`,
            failureUrl: `${origin}/order/jamm/failure`,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Jamm決済の開始に失敗しました')
        }

        console.log('[Checkout] Jamm session created:', data)

        // サーバーで作った Jamm の paymentLink へ遷移
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl as string
          return
        } else {
          throw new Error('Jamm決済URLの取得に失敗しました')
        }
      } catch (err: any) {
        debugError('[Checkout] Jamm error:', err)
        setErrorMessage(err.message ?? 'Jamm決済でエラーが発生しました。')
      }
      return
    }

    setIsLoading(true)
    try {
      if (!user) {
        throw new Error('ログインが必要です。')
      }

      // Stripe が必要な支払いタイプだけチェック
      if ((paymentType === 'card' || paymentType === 'bank_transfer') && !stripeCustomerId) {
        throw new Error('Stripeのお客様情報を取得できませんでした。ページを再読み込みしてください。')
      }

      // カード決済ならカード選択必須
      if (paymentType === 'card' && !selectedCardId) {
        throw new Error('カードを選択してください。')
      }

      // ── PayPay（Web Cashier）
      if (paymentType === 'paypay') {
        if (!isPayPayEnabled) {
          throw new Error('現在PayPayはご利用いただけません。')
        }
        if (hasShipping && !selectedAddress) {
          throw new Error('配送先住所を選択してください。')
        }

        const res = await fetchWithAuth('/api/paypay/create-code', {
          method: 'POST',
          body: JSON.stringify({
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              requiresShipping: i.requiresShipping,
              selectedOptions: i.selectedOptions || [],
              ...(Array.isArray((i as any).tags) ? { tags: (i as any).tags } : {}),
            })),
            userId: user?.uid,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            addressId: selectedAddress?.id || null,
            address: selectedAddress || null,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'PayPayの開始に失敗しました')

        console.log('✓ PayPay payment created with CSRF protection')
        window.location.href = data.cashierUrl as string
        return
      }

      // ── Stripe：カード/銀行振込
      const body = {
        items: items.map((item: CartItem) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          requiresShipping: item.requiresShipping,
          selectedOptions: item.selectedOptions || [],
          ...(Array.isArray((item as any).tags) ? { tags: (item as any).tags } : {}),
        })),
        addressId: selectedAddress?.id,
        address: selectedAddress,
        userId: user?.uid,
        customerId: stripeCustomerId,
        paymentType,
        ...(paymentType === 'card' && { paymentMethodId: selectedCardId }),
      }

      const res = await fetchWithAuth('/api/stripe/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '決済の作成に失敗しました')

      // カード：3DSが必要な場合
      if (paymentType === 'card' && data.requiresAction && data.clientSecret) {
        const stripe = await stripePromise
        if (!stripe) throw new Error('Stripeの初期化に失敗しました')

        const result = await stripe.confirmCardPayment(data.clientSecret)
        if (result.error) {
          setErrorMessage(result.error.message || 'カード認証に失敗しました。別カードでお試しください。')
          return
        }
        if (result.paymentIntent?.status === 'succeeded') {
          clearCart()
          router.push(`/order/success?orderId=${result.paymentIntent.id}&type=card&status=paid`)
          return
        }
      }

      // カード：要差し替え
      if (paymentType === 'card' && data.status === 'requires_payment_method') {
        setErrorMessage(
          data.error || 'カードの認証/決済に失敗しました。別カードを選択するか、カードを追加してください。'
        )
        return
      }

      // 通常遷移
      clearCart()
      if (paymentType === 'card') {
        router.push(`/order/success?orderId=${data.paymentIntentId}&type=card&status=${data.status}`)
      } else if (paymentType === 'bank_transfer') {
        const instructionsParam = encodeURIComponent(data.hostedInstructionsUrl || '')
        router.push(
          `/order/success?orderId=${data.paymentIntentId}&type=bank_transfer&status=pending&instructions=${instructionsParam}`
        )
      }
    } catch (err: any) {
      debugError('Checkout error:', err)
      setErrorMessage(err.message ?? '決済処理でエラーが発生しました。')
    } finally {
      setIsLoading(false)
    }
  }

  /* ───────── 空カートガード ───────── */
  if (!items.length) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-12 w-12 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">カートが空です</h1>
            <p className="text-gray-600 mb-6">商品を選んで、ショッピングを続けましょう。</p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => router.push('/store')} className="w-full bg-black hover:bg-gray-800 text-white">
              ショッピングを続ける
            </Button>
            <Button onClick={() => router.back()} variant="outline" className="w-full">
              前のページに戻る
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ───────── JSX ───────── */
  return (
    <>
      {/* ✅ Paidy SDKの読み込み */}
      <Script
        src="https://apps.paidy.com"
        strategy="afterInteractive"
        onLoad={() => console.log('✓ Paidy SDK loaded')}
      />

      <div className="container mx-auto px-4 py-8">
        {/* ステップインジケーター */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-center space-x-1 md:space-x-4 overflow-x-auto pb-2">
            {Array.from({ length: maxSteps }, (_, i) => {
              const stepNum = i + 1
              const isActive = stepNum === currentStep
              const isCompleted = stepNum < currentStep
              return (
                <div key={stepNum} className="flex items-center flex-shrink-0">
                  <div className={`
                    w-6 h-6 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-medium
                    ${isCompleted ? 'bg-gray-200 text-gray-600' :
                    isActive ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {isCompleted ? <Check className="h-2 w-2 md:h-5 md:w-5" /> : stepNum}
                  </div>
                  <span className={`ml-1 md:ml-2 text-xs md:text-sm whitespace-nowrap ${isActive ? 'font-medium' : 'text-gray-500'}`}>
                    {getStepTitle(stepNum as CheckoutStep)}
                  </span>
                  {stepNum < maxSteps && (
                    <ChevronRight className="w-2 h-2 md:w-4 md:h-4 text-gray-400 mx-1 md:mx-4" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {errorMessage}
          </div>
        )}

        {/* ステップ1: 決済方法 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-2">決済方法を選択してください</h3>
              <p className="text-sm text-gray-600">クレジットカード、PayPay、銀行振込、あと払いからお選びいただけます。</p>
            </div>

            {/* カード決済 */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">カード決済</h3>
                <div className="space-y-3">
                  {paymentMethods.map(method => (
                    <div
                      key={method.id}
                      onClick={() => { setPaymentType('card'); setSelectedCardId(method.id) }}
                      className={`cursor-pointer rounded-lg border transition-all p-4 flex items-center ${
                        paymentType === 'card' && selectedCardId === method.id
                          ? 'border-2 border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                      }`}
                    >
                      <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-gray-600" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="font-medium text-sm md:text-base">
                          {method.card.brand.toUpperCase()} **** {method.card.last4}
                        </div>
                        <div className="text-xs md:text-sm text-gray-500">
                          有効期限: {method.card.exp_month}/{method.card.exp_year}
                        </div>
                      </div>
                      {paymentType === 'card' && selectedCardId === method.id && (
                        <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  <Button
                    onClick={() => { setPaymentType('card'); handleAddPaymentMethod() }}
                    variant="outline"
                    className="w-full border-dashed border-2 h-12 text-sm md:text-base"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    新しいカードを追加
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* その他の決済方法（PayPay/Paidy/Jamm/銀行振込） */}
            <Card>
              <CardContent className="p-4 md:p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">その他の決済方法</h3>

                {/* PayPay */}
                <div className="space-y-3">
                  <div
                    onClick={() => isPayPayEnabled && setPaymentType('paypay')}
                    className={`cursor-pointer rounded-lg border transition-all p-4 flex items-center ${
                      !isPayPayEnabled
                        ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                        : paymentType === 'paypay'
                          ? 'border-2 border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                    }`}
                  >
                    <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
                      <img src="/paypay.svg" alt="PayPay" className="h-6 w-6" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="font-medium flex items-center text-sm md:text-base">
                        PayPay
                      </div>
                    </div>
                    {isPayPayEnabled && paymentType === 'paypay' && (
                      <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Paidy あと払い */}
                <div className="space-y-3 mt-3">
                  <div
                    onClick={() => setPaymentType('paidy')}
                    className={`cursor-pointer rounded-lg border transition-all p-4 flex items-center ${
                      paymentType === 'paidy'
                        ? 'border-2 border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                    }`}
                  >
                    <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
                      <BadgeJapaneseYen className="h-6 w-6 text-[#FF009C]" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="font-medium flex items-center text-sm md:text-base">
                        あと払い（ペイディ）
                      </div>
                    </div>
                    {paymentType === 'paidy' && (
                      <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Paidy詳細説明 */}
                  {paymentType === 'paidy' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <ul className="text-xs md:text-sm text-gray-700 space-y-2">
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>事前登録不要、クレジットカード登録不要。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>メールアドレスと携帯電話番号だけで、今すぐ購入可能。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>お支払いは翌月27日までに、コンビニ払い・銀行振込・口座振替で。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>1か月に何度購入しても、お支払いは翌月まとめて1回でOK。</span>
                        </li>
                      </ul>
                      <p className="text-xs text-gray-600 mt-3 leading-relaxed">
                        さらに、ペイディアプリから本人確認をすると、分割手数料無料<span className="text-[10px]">*</span>の3回あと払い<span className="text-[10px]">**</span>、ご利用可能額の確認、使い過ぎを防止する予算設定など、便利な機能がご利用いただけます。
                      </p>
                      <p className="text-[10px] text-gray-500 mt-2">
                        *口座振替・銀行振込のみ無料<br />
                        **1回のご利用金額が3,000円以上の場合のみ利用可能
                      </p>
                    </div>
                  )}
                </div>

                {/* Jamm あと払い（口座振替系） */}
                <div className="space-y-3 mt-3">
                  <div
                    onClick={() => setPaymentType('jamm')}
                    className={`cursor-pointer rounded-lg border transition-all p-4 flex items-center ${
                      paymentType === 'jamm'
                        ? 'border-2 border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                    }`}
                  >
                    <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
                      {/* 適当なアイコンでOK */}
                      <BadgeJapaneseYen className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="font-medium flex items-center text-sm md:text-base">
                        Jamm（口座振替あと払い）
                      </div>
                    </div>
                    {paymentType === 'jamm' && (
                      <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 銀行振込 */}
                <div
                  onClick={() => setPaymentType('bank_transfer')}
                  className={`cursor-pointer rounded-lg border transition-all p-4 flex items-center mt-3 ${
                    paymentType === 'bank_transfer'
                      ? 'border-2 border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300 active:bg-gray-50'
                  }`}
                >
                  <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
                    <Landmark className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-medium text-sm md:text-base">銀行振込</div>
                    <div className="text-xs md:text-sm text-gray-500">ATM / ネットバンキング</div>
                  </div>
                  {paymentType === 'bank_transfer' && (
                    <div className="w-5 h-5 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>
        )}

        {/* ステップ2: 住所選択（配送がある場合のみ） */}
        {currentStep === 2 && hasShipping && (
          <div className="space-y-6">
            <div className="mb-4">
              <h3 className="font-medium text-gray-800 mb-2">お届け先を選択してください</h3>
              <p className="text-sm text-gray-600">登録済みの住所から選択するか、新しい住所を追加してください。</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6 flex items-center">
                  <MapPin className="mr-2" />
                  お届け先
                </h2>
                <AddressSelection onSelect={handleAddressSelect} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ステップ3: 注意事項 */}
        {currentStep === (hasShipping ? 3 : 2) && (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 md:p-6">
                <h2 className="text-xl md:text-2xl font-semibold mb-4 md:mb-6 flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5 md:h-6 md:w-6" />
                  ご注文前にご確認ください
                </h2>
                <div className="bg-gray-100 p-4 rounded-lg mb-6">
                  <div className="flex items-start mb-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                    <h3 className="font-medium">【ご注意事項】</h3>
                  </div>
                  <div className="text-sm text-gray-700 ml-7 space-y-2">
                    <p>受注生産のため、配送時期が遅れる可能性があります。</p>
                    <p>※キャンセルは contact@playtune.jp まで。</p>
                    <p>※初期不良以外の返金対応は難しい場合があります。</p>
                    <p>※商品の仕様や色味は実際の商品と若干異なる場合があります。</p>
                  </div>
                </div>

                {/* Paidy選択時の詳細情報 */}
                {paymentType === 'paidy' && (
                  <div className="bg-pink-50 rounded-lg p-4 md:p-6 mb-6">
                    <div className="flex items-center mb-4">
                      <h3 className="font-medium text-gray-800">あと払い(ペイディ)</h3>
                    </div>

                    {/* 基本説明 */}
                    <ul className="text-sm text-gray-700 space-y-2 mb-4">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>事前登録不要、クレジットカード登録不要。</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>メールアドレスと携帯電話番号だけで、今すぐ購入可能。</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>お支払いは翌月27日までに、コンビニ払い・銀行振込・口座振替で。</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>1か月に何度購入しても、お支払いは翌月まとめて1回でOK。</span>
                      </li>
                    </ul>

                    {/* ご利用の流れ */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">【ご利用の流れ】</h4>
                      <ol className="text-sm text-gray-700 space-y-2 ml-4">
                        <li className="flex items-start">
                          <span className="mr-2">①</span>
                          <span>お支払い方法で「あと払い(ペイディ)」を選択して、メールアドレスと携帯電話番号を入力。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">②</span>
                          <span>SMSで送信される4桁の認証コードを入力して、購入を完了する。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">③</span>
                          <span>翌月1日〜5日の間に、ご請求金額のお知らせがメールやSMSで届く。</span>
                        </li>
                        <li className="flex items-start">
                          <span className="mr-2">④</span>
                          <span>翌月27日までに、コンビニ払い・銀行振込・口座振替でお支払いください。</span>
                        </li>
                      </ol>
                      <p className="text-xs text-gray-600 mt-2 ml-4">
                        ※口座振替をご利用の場合は、購入完了後に、ペイディアプリまたはウェブ版のMyPaidyから銀行口座をご登録ください。
                      </p>
                    </div>

                    {/* 手数料について */}
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">【手数料について】</h4>
                      <ul className="text-sm text-gray-700 space-y-1 ml-4">
                        <li><span className="font-medium">口座振替:</span> 無料</li>
                        <li><span className="font-medium">銀行振込:</span> 金融機関により振込手数料が異なります</li>
                        <li><span className="font-medium">コンビニ払い:</span> 最大390円(税込)</li>
                      </ul>
                    </div>

                    {/* 本人確認について */}
                    <div>
                      <h4 className="font-semibold text-sm text-gray-800 mb-2">【本人確認について】</h4>
                      <p className="text-sm text-gray-700 mb-2">
                        ペイディアプリから本人確認をすると、分割手数料無料<span className="text-xs">*</span>の3回あと払い<span className="text-xs">**</span>、ご利用可能額の確認、使い過ぎを防止する予算設定など、便利な機能がご利用いただけます。
                      </p>
                      <p className="text-sm font-medium text-gray-800 mb-1">ペイディアプリのダウンロードはこちら</p>
                      <div className="space-y-1 ml-4">
                        <a
                          href="https://apps.apple.com/jp/app/paidy/id1220373112"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline block"
                        >
                          App Store: https://apps.apple.com/jp/app/paidy/id1220373112
                        </a>
                        <a
                          href="https://play.google.com/store/apps/details?id=com.paidy.paidy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline block"
                        >
                          Google Play: https://play.google.com/store/apps/details?id=com.paidy.paidy
                        </a>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        *口座振替・銀行振込のみ無料<br />
                        **1回のご利用金額が3,000円以上の場合のみ利用可能
                      </p>
                    </div>
                  </div>
                )}

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreesToTerms}
                    onChange={(e) => setAgreesToTerms(e.target.checked)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-sm md:text-base">上記の注意事項を確認し、同意します。</span>
                </label>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ステップ4: 最終確認 */}
        {currentStep === maxSteps && (
          <div className="space-y-6">
            {/* 注文内容 */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6">最終確認</h2>

                {items.map(item => {
                  const uniqueKey = getUniqueItemKey(item)
                  const optionsText = formatSelectedOptions(item.selectedOptions)
                  const basePrice = getBasePrice(item)
                  const hasOptions = item.selectedOptions && item.selectedOptions.length > 0
                  return (
                    <div key={uniqueKey} className="flex items-start mb-4 border-b pb-4 last:border-b-0">
                      <div className="w-20 h-20 relative mr-4 flex-shrink-0">
                        <Image
                          src={item.images?.[0] || '/placeholder.svg'}
                          alt={item.name}
                          fill
                          sizes="(max-width: 80px) 100vw, 80px"
                          className="rounded-md object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-medium">{item.name}</h3>

                        {optionsText && (
                          <div className="flex items-center text-sm text-gray-600 mt-1 mb-2">
                            <Tag className="h-3 w-3 mr-1" />
                            <span>{optionsText}</span>
                          </div>
                        )}

                        <div className="flex items-center">
                          {hasOptions ? (
                            <div className="text-sm">
                              <div className="flex items-center">
                                <span className="font-medium">¥{item.price.toLocaleString()}</span>
                                <span className="text-gray-500 ml-2 text-xs">(基本価格: ¥{basePrice.toLocaleString()})</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm font-medium">¥{item.price.toLocaleString()}</p>
                          )}
                          {item.requiresShipping && (
                            <span className="ml-2 text-xs text-gray-500 flex items-center">
                              <Truck className="h-3 w-3 mr-1" />
                              配送が必要
                            </span>
                          )}
                        </div>

                        {/* 数量コントロール */}
                        <div className="flex items-center mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(uniqueKey, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="h-8 w-8 p-0"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="mx-3 text-sm font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(uniqueKey, item.quantity + 1)}
                            className="h-8 w-8 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-medium">¥{(item.price * item.quantity).toLocaleString()}</p>
                        {hasOptions && (
                          <p className="text-xs text-gray-500">
                            ¥{basePrice.toLocaleString()} × {item.quantity}
                            {item.selectedOptions?.some((opt: any) => opt.priceModifier > 0) && ` + オプション料金`}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => removeItem(uniqueKey)}
                          className="text-red-500 mt-2 p-1"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {/* 合計 */}
                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>小計</span>
                      <span>¥{subtotal.toLocaleString()}</span>
                    </div>

                    {hasShipping && (
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <Truck className="h-4 w-4 mr-1" />
                          送料
                        </span>
                        <span>¥{displayedShipping.toLocaleString()}</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>合計</span>
                      <span>¥{effectiveTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  {hasShipping && (
                    <div className="mt-3 border-t pt-3 text-xs text-gray-500">
                      ※配送が必要な商品を含む場合、一律¥{SHIPPING_FEE.toLocaleString()}の送料がかかります
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 決済・配送情報サマリー */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">決済・配送情報</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">決済方法:</span>
                    <span className="font-medium">
                      {paymentType === 'paypay'
                        ? 'PayPay'
                        : paymentType === 'paidy'
                          ? 'Paidyあと払い'
                          : paymentType === 'jamm'
                            ? 'Jamm 口座振替あと払い'
                            : paymentType === 'bank_transfer'
                              ? '銀行振込'
                              : 'クレジットカード'}
                    </span>
                  </div>
                  {hasShipping && selectedAddress && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">お届け先:</span>
                      <span className="font-medium text-right">
                        {selectedAddress.name}<br />
                        {selectedAddress.prefecture}{selectedAddress.city}{selectedAddress.line1}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ナビゲーション */}
        <div className="flex justify-between mt-6 md:mt-8 px-2">
          <Button
            onClick={handleBack}
            variant="outline"
            disabled={currentStep === 1}
            className="flex items-center h-12 px-4 md:px-6"
            size="sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1 md:mr-2" />
            <span className="text-sm md:text-base">戻る</span>
          </Button>

          {currentStep < maxSteps ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNext()}
              className="flex items-center bg-black hover:bg-gray-800 text-white h-12 px-4 md:px-6"
              size="sm"
            >
              <span className="text-sm md:text-base">次へ</span>
              <ChevronRight className="w-4 h-4 ml-1 md:ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCheckout}
              disabled={isLoading}
              className="flex items-center text-white h-12 px-4 md:px-6 bg-black hover:bg-gray-800"
              size="sm"
            >
              <span className="text-sm md:text-base">{isLoading ? '処理中...' : '注文を確定'}</span>
            </Button>
          )}
        </div>

        {/* カード追加モーダル */}
        {showAddCard && clientSecret && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">新しいカードを追加</h3>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CardSetupForm onSetupSuccess={handleSetupSuccess} clientSecret={clientSecret} />
                </Elements>
                <Button
                  variant="outline"
                  onClick={() => { setShowAddCard(false); setClientSecret(null) }}
                  className="mt-4 w-full"
                >
                  キャンセル
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}