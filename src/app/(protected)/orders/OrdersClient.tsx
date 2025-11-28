'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore'
import { formatDistance } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'
import {
  Package,
  Calendar,
  Receipt,
  ChevronRight,
  AlertTriangle,
  CreditCard,
  Landmark,
  Tag,
  ExternalLink,
  Gift,
  Heart,
  MessageCircle,
} from 'lucide-react'

import { useAuth } from '@/context/auth-context'
import { db } from '@/lib/firebase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

/* ------------------------------------------------------------------ */
/* 型定義 */
interface SelectedOption {
  optionId: string
  optionName: string
  valueId: string
  valueName: string
  priceModifier?: number
}

interface OrderItem {
  id?: string
  name?: string
  price: number
  quantity: number
  images?: string[]
  selectedOptions?: SelectedOption[]
  requiresShipping?: boolean
  itemType?: 'product' | 'special_cheer'
  postId?: string
  postTitle?: string
  metadata?: {
    message?: string
    groupName?: string
    [key: string]: any
  }
}

interface PayPayNativeData {
  merchantPaymentId: string
  userAuthorizationId?: string
  paymentId?: string
  paymentStatus: 'CREATED' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  createdAt: any
  completedAt?: any
  paymentDetails?: any
  lastChecked?: any
  lastApiError?: any
}

interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  subtotal: number
  shippingFee: number
  status:
    | 'pending'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'canceled'
    | 'pending_paypay'
    | 'pending_paypay_native'
    | 'pending_bank_transfer'
  paymentStatus:
    | 'pending'
    | 'paid'
    | 'succeeded'
    | 'failed'
    | 'refunded'
    | 'requires_action'
    | 'requires_confirmation'
    | 'expired'
    | 'canceled'
    | string
  paymentType?: 'card' | 'paypay' | 'bank_transfer' | 'paidy'
  createdAt: any
  updatedAt: any
  
  // Special Cheer用の追加フィールド
  orderType?: 'product' | 'special_cheer' | 'membership'
  specialCheer?: {
    postId: string
    postTitle?: string
    groupId?: string
    groupName?: string
    authorId?: string
    authorName?: string
    message?: string
    displayName?: string
    isAnonymous?: boolean
    selectedAmount: number
  }
  
  shippingInfo?: {
    address: string
    city: string
    postalCode: string
    name: string
    prefecture?: string
  }
  trackingNumber?: string
  paymentMethod?: {
    type: string
    last4?: string
    brand?: string
  }
  hostedInstructionsUrl?: string
  payPayNative?: PayPayNativeData
  provider?: string
}

/* ------------------------------------------------------------------ */
/* カードブランド → アイコン解決 */
const CARD_ICON_MAP: Record<string, string> = {
  visa: '/icons/visa.svg',
  mastercard: '/icons/mastercard.svg',
  americanexpress: '/icons/americanexpress.svg',
  amex: '/icons/americanexpress.svg',
  american_express: '/icons/americanexpress.svg',
  diners: '/icons/diners.svg',
  diners_club: '/icons/diners.svg',
  jcb: '/icons/jcb.svg',
  unionpay: '/icons/unionpay.svg',
}

const resolveCardIcon = (brand?: string | null) => {
  if (!brand) return null
  const key = String(brand).toLowerCase().replace(/\s+/g, '_')
  return CARD_ICON_MAP[key] ?? null
}

/* ------------------------------------------------------------------ */
/* ヘルパー関数 */
const getOriginalProductId = (itemId?: unknown): string | null => {
  if (typeof itemId !== 'string' || !itemId) return null
  const underscoreIndex = itemId.indexOf('_')
  return underscoreIndex !== -1 ? itemId.substring(0, underscoreIndex) : itemId
}

const fetchProductInfo = async (
  productId: string | null
): Promise<{ name: string; images?: string[] } | null> => {
  if (!productId) return null

  try {
    const ref = doc(db, 'products', productId)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const d: any = snap.data()
      return {
        name: d?.name ?? `商品 ${productId}`,
        images: d?.images ?? [],
      }
    }

    const response = await fetch(`/api/products/${productId}`)
    if (response.ok) {
      const productData = await response.json()
      return {
        name: productData?.name ?? `商品 ${productId}`,
        images: productData?.images ?? [],
      }
    }

    return null
  } catch (error) {
    console.error('商品情報の取得エラー:', error)
    return null
  }
}

/* ------------------------------------------------------------------ */
export default function OrderHistoryPage() {
  const router = useRouter()
  const { user, getIdToken } = useAuth()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [error, setError] = useState('')
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [productInfoCache, setProductInfoCache] = useState<Map<string, { name: string; images?: string[] }>>(new Map())

  /* -------------------------------------------------------------- */
  /* 商品情報を補完 */
  const enrichOrderItems = async (orders: Order[]): Promise<Order[]> => {
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const enrichedItems = await Promise.all(
          (order.items || []).map(async (item) => {
            if (item?.name && item.name !== '商品情報を取得中...') return item
            if (item?.itemType === 'special_cheer') return item

            const originalId = getOriginalProductId(item?.id)
            if (!originalId) return item

            let productInfo = productInfoCache.get(originalId)
            if (!productInfo) {
              const fetchedInfo = await fetchProductInfo(originalId)
              if (fetchedInfo) {
                productInfo = fetchedInfo
                setProductInfoCache(prev => new Map(prev).set(originalId, fetchedInfo))
              }
            }

            return productInfo
              ? { ...item, name: productInfo.name ?? item.name, images: item.images || productInfo.images }
              : item
          })
        )
        return { ...order, items: enrichedItems }
      })
    )
    return enrichedOrders
  }

  /* -------------------------------------------------------------- */
  /* 初回ロード：注文取得 */
  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=/orders')
      return
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)

        const [firestoreOrders, stripeOrders] = await Promise.all([
          fetchFirestoreOrders(),
          fetchStripeOrders(),
        ])
        const mergedOrders = mergeOrders(firestoreOrders, stripeOrders)
        const enrichedOrders = await enrichOrderItems(mergedOrders)
        setOrders(enrichedOrders)
      } catch (err) {
        console.error(err)
        setError('注文履歴の取得中にエラーが発生しました。後でもう一度お試しください。')
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [user, router])

  /* PayPay注文のリアルタイム更新 */
  useEffect(() => {
    if (!user) return

    const pendingPayPayOrders = orders.filter(
      order => order.paymentType === 'paypay' &&
      (order.status === 'pending_paypay' || order.status === 'pending_paypay_native' || order.paymentStatus === 'pending')
    )

    const unsubscribes = pendingPayPayOrders.map(order => {
      return onSnapshot(doc(db, 'orders', order.id), async (docSnap) => {
        if (docSnap.exists()) {
          const updatedOrder = { id: docSnap.id, ...docSnap.data() } as Order
          const enrichedOrder = (await enrichOrderItems([updatedOrder]))[0]
          setOrders(prevOrders => prevOrders.map(o => o.id === order.id ? enrichedOrder : o))
        }
      })
    })

    return () => unsubscribes.forEach(unsub => unsub())
  }, [orders, user])

  /* -------------------------------------------------------------- */
  /* Firestore 取得 */
  const fetchFirestoreOrders = async (): Promise<Order[]> => {
    if (!user) return []
    const qs = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    )
    const snap = await getDocs(qs)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order))
  }

  /* Stripe API 取得 */
  const fetchStripeOrders = async (): Promise<Order[]> => {
    if (!user || !getIdToken) return []
    const idToken = await getIdToken().catch(() => null)
    if (!idToken) return []
    const res = await fetch('/api/stripe/orders', {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.orders ?? []
  }

  /* 重複マージ */
  const mergeOrders = (fsOrders: Order[], stOrders: Order[]): Order[] => {
    const map = new Map<string, Order>()
    fsOrders.forEach(o => map.set(o.id, o))
    stOrders.forEach(o => {
      map.set(o.id, { ...(map.get(o.id) as Order | undefined), ...o } as Order)
    })
    return Array.from(map.values()).sort((a, b) => {
      const ad = (a.createdAt?.toDate?.() ?? a.createdAt) as Date
      const bd = (b.createdAt?.toDate?.() ?? b.createdAt) as Date
      return new Date(bd).getTime() - new Date(ad).getTime()
    })
  }

  /* -------------------------------------------------------------- */
  /* 注文展開/折りたたみ */
  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) newSet.delete(orderId)
      else newSet.add(orderId)
      return newSet
    })
  }

  const BRAND_LOGO_BOX = 'inline-flex h-4 w-10 items-center justify-center align-middle'
  const BRAND_LOGO_IMG = 'block max-h-4 max-w-[38px] object-contain'

  const getPaymentMethodDisplay = (order: Order) => {
    // PayPay決済
    if (order.paymentType === 'paypay' || order.provider?.includes('paypay')) {
      return (
        <span className="inline-flex items-center text-gray-600 align-middle">
          <span className={BRAND_LOGO_BOX}>
            <img src="/paypay.svg" alt="PayPay" className={BRAND_LOGO_IMG} />
          </span>
          <span className="ml-1">PayPay</span>
        </span>
      )
    }

    // Paidy決済
    if (order.paymentType === 'paidy' || order.provider?.includes('paidy')) {
      return (
        <span className="inline-flex items-center text-gray-600 align-middle">
          <span className="ml-1">あと払い（ペイディ）</span>
        </span>
      )
    }

    // 銀行振込
    if (order.paymentType === 'bank_transfer') {
      return (
        <span className="inline-flex items-center text-gray-600 align-middle">
          <Landmark className="h-4 w-4 mr-1 align-middle" />
          銀行振込
        </span>
      )
    }

    // カード決済
    if (order.paymentMethod?.type === 'card') {
      const brand = order.paymentMethod.brand ?? null
      const last4 = order.paymentMethod.last4
      const iconSrc = resolveCardIcon(brand)

      if (iconSrc) {
        return (
          <span className="inline-flex items-center align-middle">
            <span className={BRAND_LOGO_BOX}>
              <img
                src={iconSrc}
                alt={(brand ?? 'card').toString().toUpperCase()}
                className={BRAND_LOGO_IMG}
                loading="lazy"
                decoding="async"
              />
            </span>
            {last4 ? <span className="text-gray-500 ml-1">•••• {last4}</span> : null}
          </span>
        )
      }

      return (
        <span className="inline-flex items-center text-gray-600 align-middle">
          <CreditCard className="h-4 w-4 mr-1 align-middle" />
          {last4 ? <span className="text-gray-500">•••• {last4}</span> : 'カード'}
        </span>
      )
    }

    // デフォルト
    return (
      <span className="inline-flex items-center text-gray-600 align-middle">
        <CreditCard className="h-4 w-4 mr-1 align-middle" />
        カード決済
      </span>
    )
  }

  const getSpecialCheerStatusBadge = (paymentStatus: string, orderStatus: string) => {
    // キャンセル
    if (orderStatus === 'canceled' || paymentStatus === 'canceled') {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">キャンセル</Badge>
    }
    
    // 決済失敗
    if (paymentStatus === 'failed') {
      return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">決済失敗</Badge>
    }
    
    // 期限切れ
    if (paymentStatus === 'expired') {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">期限切れ</Badge>
    }
    
    // 返金済み
    if (paymentStatus === 'refunded') {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">返金済み</Badge>
    }
    
    // 決済完了 = 完了（Special Cheerは発送がないため）
    if (['succeeded', 'paid'].includes(paymentStatus.toLowerCase()) || orderStatus === 'completed') {
      return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">完了</Badge>
    }
    
    // 未入金
    if (['pending', 'requires_payment_method', 'requires_confirmation', 'requires_action'].includes(paymentStatus)) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">未入金</Badge>
    }
    
    // デフォルト
    return <Badge variant="outline">処理中</Badge>
  }

  /* -------------------------------------------------------------- */
  /* ステータス/バッジ */
  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'pending':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">処理中</Badge>
      case 'pending_paypay':
      case 'pending_paypay_native':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">PayPay決済待ち</Badge>
      case 'pending_bank_transfer':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">振込待ち</Badge>
      case 'processing':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">発送準備中</Badge>
      case 'shipped':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">発送完了</Badge>
      case 'delivered':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">配達完了</Badge>
      case 'canceled':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">キャンセル</Badge>
      default:
        return <Badge variant="outline">処理中</Badge>
    }
  }

  const getPaymentStatusBadge = (s: string) => {
    switch (s) {
      case 'pending':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">未入金</Badge>
      case 'succeeded':
      case 'paid':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">支払済み</Badge>
      case 'failed':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">決済失敗</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">期限切れ</Badge>
      case 'canceled':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">キャンセル</Badge>
      case 'refunded':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">返金済み</Badge>
      default:
        return <Badge variant="outline">未確認</Badge>
    }
  }

  const formatOrderTime = (ts: any) => {
    const d =
      ts?.toDate?.() ??
      (typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts))
    if (isNaN(d.getTime())) return ''
    return formatDistance(d, new Date(), { addSuffix: true, locale: ja })
  }

  const formatSelectedOptions = (options?: SelectedOption[]) => {
    if (!options || options.length === 0) return null
    return options.map(opt => `${opt.optionName}: ${opt.valueName}`).join(', ')
  }

  /* PayPay決済状況の更新 */
  const refreshPayPayStatus = async (orderId: string) => {
    try {
      const response = await fetch(`/api/paypay/native/status?orderId=${orderId}&forceRefresh=true`)
      if (response.ok) return await response.json()
    } catch (error) {
      console.error('PayPay status refresh error:', error)
    }
  }

  /* PayPay再決済 */
  const handlePayPayRestart = async (order: Order) => {
    setProcessingOrderId(order.id)
    try {
      const payload = {
        userId: order.userId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        items: (order.items || []).map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
      }

      const res = await fetch('/api/paypay/create-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'PayPayの再決済に失敗しました')

      if (data.cashierUrl) {
        window.location.href = data.cashierUrl
      } else {
        throw new Error('決済URLを取得できませんでした')
      }
    } catch (e: any) {
      console.error('PayPay restart error:', e)
      alert(e?.message || 'PayPayの再決済に失敗しました')
    } finally {
      setProcessingOrderId(null)
    }
  }

  /* 注文キャンセル処理 */
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('この注文をキャンセルしますか？この操作は取り消せません。')) return
    setProcessingOrderId(orderId)
    try {
      const token = (await getIdToken?.().catch(() => null)) || null
      const response = await fetch('/api/stripe/order-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId })
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'キャンセル処理に失敗しました')
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'canceled', paymentStatus: 'canceled' } : o))
      alert('注文をキャンセルしました。')
    } catch (error) {
      console.error('Cancel order error:', error)
      alert('注文のキャンセルに失敗しました。お手数ですがお問い合わせください。')
    } finally {
      setProcessingOrderId(null)
    }
  }

  /* 決済完了画面への移動 */
  const handleViewPaymentStatus = (orderId: string) => {
    router.push(`/order/success?orderId=${orderId}&type=paypay_native&status=pending&poll=${encodeURIComponent(`/api/paypay/native/status?orderId=${orderId}`)}`)
  }

  /* -------------------------------------------------------------- */
  /* Loading / Error handling */
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">注文履歴</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded" />
                  <div className="flex-grow">
                    <Skeleton className="h-4 w-64 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">注文履歴</h1>
        <div className="text-center py-12 bg-red-50 rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-200 mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">エラーが発生しました</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>再試行</Button>
        </div>
      </div>
    )
  }

  /* -------------------------------------------------------------- */
  /* Render */
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">注文履歴</h1>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList>
          <TabsTrigger value="all">すべて</TabsTrigger>
          <TabsTrigger value="products">商品</TabsTrigger>
          <TabsTrigger value="special_cheer">Special Cheer</TabsTrigger>
        </TabsList>
      </Tabs>

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">注文履歴がありません</h3>
          <p className="text-gray-500 mb-6">
            {activeTab === 'all'
              ? 'まだ注文履歴がありません。'
              : `${activeTab === 'products' ? '商品' : 'Special Cheer'}の注文はありません。`}
          </p>
          <Button onClick={() => router.push('/store')}>ショッピングを続ける</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders
            .filter(o => {
              if (activeTab === 'all') return true
              
              const items = o.items || []
              const hasSpecialCheer = items.some(item => item.itemType === 'special_cheer')
              
              if (activeTab === 'products') {
                return o.orderType === 'product' || (!o.orderType && !hasSpecialCheer)
              }
              
              if (activeTab === 'special_cheer') {
                return o.orderType === 'special_cheer' || hasSpecialCheer
              }
              
              return true
            })
            .map(order => {
              const isExpanded = expandedOrders.has(order.id)
              const items = order.items || []
              const first = items[0]
              
              // ✅ 修正: itemTypeで判定
              const isSpecialCheer = order.orderType === 'special_cheer' || first?.itemType === 'special_cheer'
              
              const firstName = first?.name ?? '商品情報を取得中...'
              const firstImg = first?.images?.[0]
              const hasMultipleItems = items.length > 1
              const tracking =
                order.trackingNumber ??
                (order as any).shippingNumber ??
                (order as any).tracking_no
              const isPaid = ['paid', 'succeeded'].includes(String(order.paymentStatus).toLowerCase())

              // ✅ Special Cheer情報を構築
              const specialCheerData = order.specialCheer || (isSpecialCheer && first ? {
                postId: first.postId || '',
                postTitle: first.postTitle || first.name || '記事',
                groupId: first.metadata?.groupId,
                groupName: first.metadata?.groupName,
                authorId: first.metadata?.authorId,
                authorName: first.metadata?.authorName,
                message: first.metadata?.message,
                displayName: first.metadata?.displayName,
                isAnonymous: first.metadata?.isAnonymous,
                selectedAmount: first.price || 0,
              } : null)

              // Special Cheer専用の表示
              if (isSpecialCheer && specialCheerData) {
                return (
                  <Card key={order.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-sm text-gray-500 flex items-center leading-none">
                            <span className="whitespace-nowrap">注文番号: {order.id.substring(0, 8)}</span>
                            <span className="ml-2 flex items-center">{getPaymentMethodDisplay(order)}</span>
                          </p>
                          <p className="text-xs text-gray-500 flex items-center mt-1">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatOrderTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                            Special Cheer
                          </Badge>
                          {getSpecialCheerStatusBadge(order.paymentStatus, order.status)}
                        </div>
                      </div>
                      
                      {/* Special Cheer情報 */}
                      <div className="p-6">
                        <div className="flex gap-4">
                          {/* アイコン */}
                          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                            <Gift className="h-8 w-8 text-amber-600" />
                          </div>

                          {/* メイン情報 */}
                          <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="h-5 w-5 text-red-500 fill-current" />
                              <h3 className="font-bold text-lg">¥{specialCheerData.selectedAmount.toLocaleString()} のSpecial Cheer</h3>
                            </div>

                            {/* 記事情報 */}
                            <div className="bg-gray-50 rounded-lg p-3 mb-3">
                              <p className="text-sm text-gray-500 mb-1">送信先記事</p>
                              <p className="font-medium">{specialCheerData.postTitle || '記事タイトル'}</p>
                              {specialCheerData.groupName && (
                                <p className="text-sm text-gray-600 mt-1">
                                  From: {specialCheerData.groupName}
                                </p>
                              )}
                              {specialCheerData.authorName && (
                                <p className="text-sm text-gray-600">
                                  投稿者: {specialCheerData.authorName}
                                </p>
                              )}
                              {specialCheerData.postId && (
                                <Button
                                  asChild
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 mt-2"
                                >
                                  <a
                                    href={`/post/${specialCheerData.postId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center text-blue-600"
                                  >
                                    記事を見る
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                </Button>
                              )}
                            </div>

                            {/* メッセージ */}
                            {specialCheerData.message && (
                              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <MessageCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                  <div className="flex-grow">
                                    <p className="text-xs text-gray-500 mb-1">あなたのメッセージ</p>
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                      {specialCheerData.message}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 匿名表示 */}
                            {specialCheerData.isAnonymous && (
                              <p className="text-xs text-gray-500 mt-2">
                                ※ 匿名で送信されました
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              // 通常の商品注文の表示
              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-sm text-gray-500 flex items-center leading-none">
                          <span className="whitespace-nowrap">注文番号: {order.id.substring(0, 8)}</span>
                          <span className="ml-2 flex items-center">{getPaymentMethodDisplay(order)}</span>
                        </p>
                        <p className="text-xs text-gray-500 flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatOrderTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {isPaid ? getStatusBadge(order.status) : getPaymentStatusBadge(order.paymentStatus)}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex flex-wrap md:flex-nowrap gap-4">
                        <div className="w-full md:w-auto flex items-start">
                          <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden relative shrink-0">
                            {firstImg ? (
                              <Image src={firstImg} alt={firstName} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                          </div>
                          {hasMultipleItems && (
                            <span className="ml-2 text-xs bg-gray-200 rounded-full px-2 py-1">
                              +{items.length - 1}点
                            </span>
                          )}
                        </div>

                        <div className="flex-grow">
                          <h3 className="font-medium mb-1">
                            {firstName}
                            {hasMultipleItems && ` 他${items.length - 1}点`}
                          </h3>

                          {first?.selectedOptions && first.selectedOptions.length > 0 && (
                            <div className="flex items-center text-xs text-gray-500 mb-1">
                              <Tag className="h-3 w-3 mr-1" />
                              <span>{formatSelectedOptions(first.selectedOptions)}</span>
                            </div>
                          )}

                          <div className="flex items-center text-sm text-gray-500 mb-2">
                            <Receipt className="h-4 w-4 mr-1" />
                            <span>合計: ¥{(order.total || 0).toLocaleString()}</span>
                          </div>

                          {hasMultipleItems && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleOrderExpansion(order.id)}
                              className="text-xs h-6 px-2 mb-2"
                            >
                              {isExpanded ? '詳細を閉じる' : '詳細を見る'}
                              <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </Button>
                          )}

                          {isExpanded && hasMultipleItems && (
                            <div className="mt-3 space-y-3 border-t pt-3">
                              {items.map((item, index) => {
                                const img = item.images?.[0]
                                const nm = item.name ?? `商品 ${item.id ?? index}`
                                return (
                                  <div key={`${item.id ?? 'noid'}-${index}`} className="flex gap-3 text-sm">
                                    <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden relative shrink-0">
                                      {img ? (
                                        <Image
                                          src={img}
                                          alt={nm}
                                          fill
                                          className="object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Package className="h-6 w-6 text-gray-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-grow">
                                      <p className="font-medium">{nm}</p>
                                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                                        <div className="flex items-center text-xs text-gray-500 mt-1">
                                          <Tag className="h-3 w-3 mr-1" />
                                          <span>{formatSelectedOptions(item.selectedOptions)}</span>
                                        </div>
                                      )}
                                      <div className="text-gray-500 text-xs mt-1">
                                        数量: {item.quantity} × ¥{(item.price || 0).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {(order.status === 'shipped' || order.status === 'delivered') && tracking && (
                            <div className="text-sm">
                              <span className="text-gray-500">追跡番号(ヤマト運輸): </span>
                              <a
                                href={`https://jizen.kuronekoyamato.co.jp/jizen/servlet/crjz.b.NQ0010?id=${encodeURIComponent(tracking)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 underline inline-flex items-center"
                              >
                                {tracking}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            </div>
                          )}

                          {getPaymentAlert(order)}

                          {order.status === 'canceled' && (
                            <div className="flex items-center text-sm text-red-600 mt-2">
                              <AlertTriangle className="h-4 w-4 mr-1" />
                              <span>この注文はキャンセルされました</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </div>
      )}
    </div>
  )

  /* ---- 内部関数:決済別アラート ---- */
  function getPaymentAlert(order: Order) {
    const isPayPayNative = order.paymentType === 'paypay' && order.payPayNative
    const isPayPayPending =
      order.paymentType === 'paypay' &&
      (order.status === 'pending_paypay' ||
        order.status === 'pending_paypay_native' ||
        order.paymentStatus === 'pending')

    if (isPayPayNative && isPayPayPending) {
      return (
        <div className="mt-3 flex items-start text-gray-700 bg-white border rounded-lg p-3">
          <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
            <img src="/paypay.svg" alt="PayPay" className="h-6 w-6" />
          </div>
          <div className="text-sm flex-grow">
            <p className="font-medium mb-1 flex items-center">PayPay決済が完了していません</p>
            <p className="mb-3">PayPayアプリで決済を完了してください。決済完了後、自動でステータスが更新されます。</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => handlePayPayRestart(order)}
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white flex-1"
                disabled={processingOrderId === order.id}
              >
                再決済（PayPayをもう一度開く）
              </Button>

              <Button
                onClick={() => handleCancelOrder(order.id)}
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={processingOrderId === order.id}
              >
                注文をキャンセル
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (
      order.paymentType === 'paypay' &&
      (order.paymentStatus === 'failed' || order.payPayNative?.paymentStatus === 'FAILED')
    ) {
      return (
        <div className="mt-3 flex items-start text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle className="h-5 w-5 mr-2 shrink-0" />
          <div className="text-sm flex-grow">
            <p className="font-medium mb-1">PayPay決済が失敗しました</p>
            <p className="mb-3">決済処理中にエラーが発生しました。もう一度注文をやり直してください。</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => handlePayPayRestart(order)}
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white flex-1"
                disabled={processingOrderId === order.id}
              >
                再決済（PayPayを開く）
              </Button>
              <Button
                onClick={() => handleCancelOrder(order.id)}
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={processingOrderId === order.id}
              >
                注文をキャンセル
              </Button>
            </div>
          </div>
        </div>
      )
    }

    if (
      order.paymentType === 'paypay' &&
      (order.paymentStatus === 'expired' ||
        order.paymentStatus === 'canceled' ||
        order.payPayNative?.paymentStatus === 'CANCELED')
    ) {
      return (
        <div className="mt-3 flex items-start text-gray-700 bg-white border rounded-lg p-3">
          <div className="mr-3 h-8 w-8 flex-shrink-0 flex items-center justify-center">
            <img src="/paypay.svg" alt="PayPay" style={{ width: 40, height: 20 }} />
          </div>
          <div className="text-sm">
            <p className="font-medium mb-1">
              {order.paymentStatus === 'expired'
                ? 'PayPay決済の有効期限が切れました'
                : 'PayPay決済がキャンセルされました'}
            </p>
            <p>
              {order.paymentStatus === 'expired'
                ? '決済の有効期限が切れたため、注文がキャンセルされました。お手数ですが、もう一度注文をやり直してください。'
                : '決済がキャンセルされたため、注文がキャンセルされました。お手数ですが、もう一度注文をやり直してください。'}
            </p>
          </div>
        </div>
      )
    }

    if (
      (order.paymentStatus === 'requires_action' ||
        order.paymentStatus === 'pending' ||
        order.paymentStatus === 'requires_confirmation') &&
      order.paymentType === 'bank_transfer'
    ) {
      return (
        <div className="mt-3 flex items-start text-gray-700 bg-white border rounded-lg p-3">
          <Landmark className="h-5 w-5 mr-2 shrink-0" />
          <div className="text-sm">
            <p className="font-medium mb-1">ご入金待ち</p>
            <p>銀行振込がまだ確認できていません。入金後、ステータスが自動で更新されます。</p>
            {order.hostedInstructionsUrl && (
              <Button asChild size="sm" variant="link" className="pl-0">
                <a href={order.hostedInstructionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  振込先を確認
                </a>
              </Button>
            )}
          </div>
        </div>
      )
    }

    return null
  }
}