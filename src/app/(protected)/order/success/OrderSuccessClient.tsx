// app/(protected)/order/success/OrderSuccessClient.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import Link from 'next/link'
import {
  X,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Clock,
  CreditCard,
  Landmark,
  Smartphone,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Package,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackModal } from '@/components/store/FeedbackModal'
import { db } from '@/lib/firebase'

const isDev = process.env.NODE_ENV !== 'production'

type PayPayPhase = 'pending' | 'completed' | 'failed' | 'cancelled'
type OrderStage = 'paid' | 'pending'

export default function OrderSuccessClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const orderId = searchParams.get('orderId') || ''
  const type = (searchParams.get('type') || '').toLowerCase() // 'card' | 'bank_transfer' | 'paypay' | 'paypay_native' | 'paidy'
  const statusParam = (searchParams.get('status') || '').toLowerCase()
  const instructions = searchParams.get('instructions')
  const pollUrl = searchParams.get('poll') // 使わないが互換のため保持

  // PayPay
  const [payPayStatus, setPayPayStatus] = useState<PayPayPhase>('pending')
  const [isPolling, setIsPolling] = useState(false)
  const [pollingError, setPollingError] = useState<string | null>(null)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)

  // 旧フィードバック
  const [feedbackType, setFeedbackType] = useState<'good' | 'bad' | null>(null)
  const [hasFeedback, setHasFeedback] = useState(false)
  const [submittedFeedbackType, setSubmittedFeedbackType] = useState<'good' | 'bad' | null>(null)

  // 注文ステータス
  const [orderStatus, setOrderStatus] = useState<OrderStage>(() => {
    if (statusParam === 'paid') return 'paid'
    if (statusParam === 'pending') return 'pending'
    // パラメータなし時の既定：カードは即 paid、それ以外は pending
    return type === 'card' ? 'paid' : 'pending'
  })

  const isPayPay = type === 'paypay' || type === 'paypay_native'

  // 1) 先に useCallback 化（router と type を使うので依存に含める）
  const pollPayPayStatus = useCallback(async (id: string) => {
    const maxAttempts = 60
    let attempts = 0

    const once = async () => {
      try {
        attempts++
        const response = await fetch(`/api/paypay/native/status?orderId=${encodeURIComponent(id)}&forceRefresh=true`, {
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(await response.text().catch(() => '決済状況の確認に失敗しました'))

        const data = await response.json()
        setPaymentDetails(data.paymentDetails)

        const normalized = String(data.status || '').toLowerCase()
        if (normalized === 'completed') {
          setPayPayStatus('completed')
          setOrderStatus('paid')
          setIsPolling(false)
          // ← type / router を使うので useCallback の依存に含める
          router.replace(`/order/success?orderId=${id}&status=paid&type=${type}`)
          return
        }
        if (normalized === 'failed') {
          setPayPayStatus('failed')
          setIsPolling(false)
          return
        }
        if (normalized === 'cancelled' || normalized === 'canceled') {
          setPayPayStatus('cancelled')
          setIsPolling(false)
          return
        }

        if (attempts < maxAttempts) {
          setTimeout(once, 3000)
        } else {
          setPollingError('決済の確認がタイムアウトしました。注文履歴をご確認ください。')
          setIsPolling(false)
        }
      } catch (err) {
        console.error('PayPay status polling error:', err)
        setPollingError('決済状況の確認中にエラーが発生しました')
        setIsPolling(false)
      }
    }

    once()
  }, [router, type])   // ★依存を明示

  /* ----------------------- PayPay: ステータスポーリング ---------------------- */
    useEffect(() => {
      if (!isPayPay) return
      if (!orderId) return
      if (orderStatus !== 'pending') return

      setIsPolling(true)
      pollPayPayStatus(orderId)
    }, [isPayPay, orderId, orderStatus, pollPayPayStatus])  // ★更新

  /* ----------------- Firestore 監視（カード / 銀行振込のみ） ----------------- */
  useEffect(() => {
    if (isPayPay) return // ← PayPay のときは未ログインの可能性が高いので監視しない
    if (orderStatus !== 'pending' || !orderId) return

    const unsub = onSnapshot(
      doc(db, 'orders', orderId),
      snap => {
        const data = snap.data()
        const st = (data?.paymentStatus || '').toLowerCase()
        if (st === 'succeeded' || st === 'paid') {
          setOrderStatus('paid')
          router.replace(`/order/success?orderId=${orderId}&status=paid&type=${type}`)
        }
      },
      err => {
        // ここで権限エラー（Missing or insufficient permissions）を握りつぶす
        console.warn('orders watch error (ignored):', err?.message || err)
      }
    )
    return unsub
  }, [isPayPay, orderStatus, orderId, type, router])

  /* ----------------------------- Dev サンプルUI ----------------------------- */
  const DevSample = useMemo(() => {
    if (!isDev) return null
    return (
      <div className="w-full max-w-2xl mx-auto mb-6 rounded-lg border p-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <div className="font-semibold">Devモード（サンプルUI）</div>
            <div className="text-xs">このブロックは開発時だけ表示されます</div>
          </div>
          <div className="text-xs text-gray-500">orderId: {orderId || '(未指定)'}</div>
        </div>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">決済種別</span>
            <code className="px-2 py-1 rounded bg-white border">{type || '(none)'}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">注文状態</span>
            <code className="px-2 py-1 rounded bg-white border">{orderStatus}</code>
          </div>
          {isPayPay && (
            <div className="flex items-center justify-between">
              <span className="text-gray-700">PayPay ステータス</span>
              <code className="px-2 py-1 rounded bg-white border">{payPayStatus}</code>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPollingError(null)
              setOrderStatus('pending')
              if (isPayPay && orderId) {
                setPayPayStatus('pending')
                setIsPolling(true)
                pollPayPayStatus(orderId)
              }
            }}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            再チェック
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setOrderStatus('paid')
              setPayPayStatus('completed')
            }}
            className="bg-black hover:bg-gray-800 text-white"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            強制的に「支払い完了」に
          </Button>
        </div>

        {/* サンプル商品表示 */}
        <div className="mt-6 rounded-lg bg-white border p-4">
          <div className="font-semibold mb-3">サンプル商品</div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <div>PLAYTUNE Tシャツ（L）</div>
              <div className="text-gray-500 text-xs">カラー: ブラック / 数量: 1</div>
            </div>
            <div>¥3,500</div>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <div>送料</div>
            <div>¥800</div>
          </div>
          <div className="flex items-center justify-between font-semibold mt-2 border-t pt-2">
            <div>合計</div>
            <div>¥4,300</div>
          </div>
        </div>
      </div>
    )
  }, [isDev, isPayPay, orderId, orderStatus, payPayStatus, type])

  /* --------------------------------- ガード --------------------------------- */
  if (!orderId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-red-900">エラー</h1>
          <p className="text-red-600 mb-6">注文情報が見つかりません。</p>
          <Button onClick={() => router.push('/store')}>ストアに戻る</Button>
        </div>
      </div>
    )
  }

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center p-4">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <a href="/">
            <X className="h-6 w-6" />
          </a>
        </Button>
        <Button variant="ghost" size="sm">ヘルプ</Button>
      </div>

      {/* Dev サンプルUI */}
      {DevSample}

      {/* Content */}
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        {/* Illustration */}
        <div className="relative my-8">
          <img
            src="/img/shopping_bag.png"
            alt="Order Success"
            className="w-[200px] h-[200px] object-contain mx-auto"
          />
        </div>

        {/* ポーリングエラー */}
        {pollingError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{pollingError}</p>
          </div>
        )}

        {/* ペンディング表示 */}
        {orderStatus === 'pending' && (
          <>
            {isPayPay ? (
              <>
                <h1 className="text-2xl font-bold">
                  {isPolling ? 'お支払いを確認中です…' : 'PayPay決済処理中'}
                </h1>
                <p className="text-gray-600">PayPay アプリで決済を完了すると自動で更新されます。</p>

                {isPolling && (
                  <div className="flex justify-center">
                    <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
                  </div>
                )}

                {/* 失敗/キャンセル */}
                {(payPayStatus === 'failed' || payPayStatus === 'cancelled') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-2" />
                    <p className="text-sm text-red-600 mb-4">
                      PayPay決済が{payPayStatus === 'failed' ? '失敗' : 'キャンセル'}されました。もう一度注文をやり直してください。
                    </p>
                    <Button asChild className="w-full max-w-xs bg-black hover:bg-gray-800">
                      <Link href="/store">再注文する</Link>
                    </Button>
                  </div>
                )}

                {/* 手動更新 */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => pollPayPayStatus(orderId)}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    状況を更新
                  </Button>
                </div>
              </>
            ) : type === 'bank_transfer' ? (
              <>
                <h1 className="text-2xl font-bold">ご入金を確認中です…</h1>
                <p className="text-gray-600">銀行振込が完了すると自動で更新されます。</p>

                {instructions && (
                  <Button
                    asChild
                    variant="default"
                    className="w-full max-w-xs bg-black hover:bg-gray-800 mt-6"
                  >
                    <a
                      href={decodeURIComponent(instructions)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      振込先を確認する
                    </a>
                  </Button>
                )}
              </>
            ) : type === 'paidy' ? (
              <>
                <h1 className="text-2xl font-bold">ご注文を受け付けました</h1>
                <p className="text-gray-600">
                  Paidyあと払いでのお手続きが完了しました。<br />
                  与信の確定後、注文が確定し、発送準備に入ります。<br />
                  詳細はメールでご案内いたします。
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">お支払いを確認中です…</h1>
                <p className="text-gray-600">決済が完了すると自動で更新されます。</p>
              </>
            )}
          </>
        )}

        {/* 完了表示 */}
        {orderStatus === 'paid' && (
          <>
            <h1 className="text-2xl font-bold">ご注文ありがとうございます</h1>
            <p className="text-gray-600">
              PLAYTUNE&nbsp;STOREをご利用いただき、ありがとうございます。
              {!hasFeedback && ' 今回のお買い物についてご感想をお聞かせください。'}
            </p>
          </>
        )}

        {/* 注文番号 */}
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <span>注文番号:</span>
          <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
            {orderId.substring(0, 8)}
          </code>
        </div>

        {/* フィードバック（支払い完了後） */}
        {orderStatus === 'paid' && !hasFeedback && (
          <div className="space-y-8">
            <div className="flex justify-center space-x-12">
              <button
                className="flex flex-col items-center space-y-2 group"
                onClick={() => setFeedbackType('good')}
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200">
                  <ThumbsUp className="h-8 w-8 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">良かった</span>
              </button>
              <button
                className="flex flex-col items-center space-y-2 group"
                onClick={() => setFeedbackType('bad')}
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200">
                  <ThumbsDown className="h-8 w-8 text-gray-600" />
                </div>
                <span className="text-sm text-gray-600">改善してほしい</span>
              </button>
            </div>
          </div>
        )}

        {/* フィードバック完了表示 */}
        {orderStatus === 'paid' && hasFeedback && (
          <div className="space-y-4">
            {submittedFeedbackType === 'good' ? (
              <div className="text-green-600 font-medium">
                フィードバックをお送りいただき、ありがとうございました。
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-4 space-y-4">
                <div className="text-gray-600 font-medium">
                  ご不便をおかけし、申し訳ございません。改善に向けて努力いたします。
                </div>
                <Button
                  asChild
                  variant="default"
                  className="w-full max-w-xs bg-black hover:bg-gray-800"
                >
                  <Link href="/contact">お問い合わせはこちら</Link>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Links */}
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
        type={feedbackType ?? 'good'}
        orderId={orderId}
        onFeedbackSubmit={(t) => {
          setHasFeedback(true)
          setSubmittedFeedbackType(t)
        }}
      />
    </div>
  )
}
