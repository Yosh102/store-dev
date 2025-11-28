// app/api/stripe/create-subscription/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'
import { Timestamp } from 'firebase-admin/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

// レート制限用の簡易キャッシュ（本番ではRedis推奨）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX = 3 // 1分に3回まで

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const existing = rateLimitMap.get(userId)

  if (!existing || now > existing.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return false
  }

  existing.count++
  return true
}

// 環境変数でのPrice ID ホワイトリスト
const ENV_ALLOWED = (process.env.STRIPE_ALLOWED_PRICE_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function isPriceAllowed(priceId: string): boolean {
  if (ENV_ALLOWED.length === 0) return true
  return ENV_ALLOWED.includes(priceId)
}

// planTypeとStripe Priceの整合チェック
function matchesPlanType(planType: string, price: Stripe.Price): boolean {
  const interval = price.recurring?.interval
  if (!interval) return false
  if (planType === 'monthly') return interval === 'month'
  if (planType === 'yearly') return interval === 'year'
  return false
}

// 監査ログの記録
async function logAudit(data: {
  action: string
  userId: string
  groupId?: string
  subscriptionId?: string
  status: 'success' | 'failed'
  error?: string
  metadata?: any
}) {
  try {
    // undefinedを除外してFirestoreに保存
    const cleanData = JSON.parse(JSON.stringify({
      ...data,
      timestamp: Timestamp.now(),
      ip: data.metadata?.ip || 'unknown',
    }))
    
    await adminDb.collection('auditLogs').add(cleanData)
  } catch (e) {
    console.error('Failed to log audit:', e)
  }
}
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  let userId: string | undefined

  try {
    // ========== CSRF検証 ==========
    if (!verifyCSRFToken(req)) {
      await logCSRFFailure(req, '/api/stripe/create-subscription', adminDb)
      return NextResponse.json({
        error: 'SUB-C-003',
        message: 'Invalid CSRF token'
      }, { status: 403 })
    }

    // ========== 認証 ==========
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'AUTH-001',
        message: 'Authorization header is missing'
      }, { status: 401 })
    }

    const idToken = authHeader.slice('Bearer '.length)
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null)
    if (!decoded?.uid) {
      return NextResponse.json({
        error: 'AUTH-002',
        message: 'Invalid Firebase ID token'
      }, { status: 401 })
    }
    userId = decoded.uid

    // ========== レート制限 ==========
    if (!checkRateLimit(userId)) {
      await logAudit({
        action: 'create_subscription_rate_limited',
        userId,
        status: 'failed',
        error: 'Rate limit exceeded',
      })
      return NextResponse.json({
        error: 'SUB-S-008',
        message: 'Too many requests'
      }, { status: 429 })
    }

    // ========== 入力検証 ==========
    const { groupId, planType, priceId, paymentMethodId, customerId } = await req.json()

    if (!groupId || !planType || !priceId || !paymentMethodId || !customerId) {
      return NextResponse.json({
        error: 'GEN-001',
        message: 'Missing required fields'
      }, { status: 400 })
    }

    // planTypeのバリデーション
    if (planType !== 'monthly' && planType !== 'yearly') {
      return NextResponse.json({
        error: 'SUB-S-006',
        message: 'Invalid plan type'
      }, { status: 400 })
    }

    // ========== ユーザー検証とcustomerId確認 ==========
    const userSnap = await adminDb.collection('users').doc(userId).get()
    const userData = userSnap.exists ? userSnap.data() : null

    if (!userData?.stripeCustomerId || userData.stripeCustomerId !== customerId) {
      console.error('Customer mismatch:', {
        userId,
        requestCustomerId: customerId,
        firestoreCustomerId: userData?.stripeCustomerId
      })
      await logAudit({
        action: 'create_subscription_customer_mismatch',
        userId,
        groupId,
        status: 'failed',
        error: 'Customer ID mismatch',
        metadata: { requestCustomerId: customerId, firestoreCustomerId: userData?.stripeCustomerId }
      })
      return NextResponse.json({
        error: 'SUB-C-002',
        message: 'Customer ID does not match user record'
      }, { status: 403 })
    }

    // ========== 重複サブスクリプションチェック ==========
    const existingSubscription = userData.subscriptions?.[groupId]
    if (existingSubscription?.status === 'active') {
      return NextResponse.json({
        error: 'SUB-S-003',
        message: 'Already subscribed to this group'
      }, { status: 400 })
    }

    // ========== Group検証とpriceIdの整合性チェック ==========
    const groupSnap = await adminDb.collection('groups').doc(groupId).get()
    if (!groupSnap.exists) {
      return NextResponse.json({
        error: 'SUB-S-005',
        message: 'Group not found'
      }, { status: 404 })
    }

    const groupData = groupSnap.data()
    const validPriceIds = [
      groupData?.subscriptionPlans?.monthly?.priceId,
      groupData?.subscriptionPlans?.yearly?.priceId
    ].filter(Boolean)

    if (!validPriceIds.includes(priceId)) {
      console.error('Price ID mismatch:', {
        userId,
        groupId,
        requestPriceId: priceId,
        validPriceIds
      })
      await logAudit({
        action: 'create_subscription_invalid_price',
        userId,
        groupId,
        status: 'failed',
        error: 'Price ID does not match group plans',
        metadata: { requestPriceId: priceId, validPriceIds }
      })
      return NextResponse.json({
        error: 'SUB-S-006',
        message: 'Price ID does not match group plan'
      }, { status: 400 })
    }

    // ========== 環境変数ホワイトリストチェック ==========
    if (!isPriceAllowed(priceId)) {
      return NextResponse.json({
        error: 'SUB-S-006',
        message: 'Price not allowed'
      }, { status: 400 })
    }

    // ========== Stripe Price検証 ==========
    const price = await stripe.prices.retrieve(priceId)
    if (price.deleted || !price.active) {
      return NextResponse.json({
        error: 'SUB-S-009',
        message: 'Price is inactive or deleted'
      }, { status: 400 })
    }
    if (price.currency !== 'jpy') {
      return NextResponse.json({
        error: 'SUB-S-009',
        message: 'Invalid currency'
      }, { status: 400 })
    }
    if (!price.type || price.type !== 'recurring' || !price.recurring) {
      return NextResponse.json({
        error: 'SUB-S-009',
        message: 'Price is not recurring'
      }, { status: 400 })
    }
    if (!matchesPlanType(planType, price)) {
      return NextResponse.json({
        error: 'SUB-S-006',
        message: 'Plan type does not match price interval'
      }, { status: 400 })
    }

    // ========== PaymentMethod検証とアタッチ ==========
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)

    if (!pm.customer) {
      // 未紐付けの場合はアタッチ
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
    } else if (pm.customer !== customerId) {
      // 他の顧客に紐付いている場合はエラー
      return NextResponse.json({
        error: 'SUB-S-007',
        message: 'Payment method belongs to another customer'
      }, { status: 403 })
    }

    // ========== CustomerのデフォルトPM設定 ==========
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
      metadata: { firebaseUserId: userId },
    })

    // ========== サブスクリプション作成 ==========
    const idempotencyKey = `sub:${userId}:${groupId}:${Date.now()}`
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        groupId,
        firebaseUserId: userId,
        planType,
      },
    }, { idempotencyKey })

    const invoice = subscription.latest_invoice as Stripe.Invoice | null
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null

    // ========== Firestoreへ反映 ==========
    await adminDb.runTransaction(async (tx) => {
      const userRef = adminDb.collection('users').doc(userId!)
      const groupRef = adminDb.collection('groups').doc(groupId)

      // users コレクションに subscription を追加
      tx.set(userRef, {
        subscriptions: {
          [groupId]: {
            id: subscription.id,
            status: subscription.status,
            planType,
            currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
        },
      }, { merge: true })

      // groups/{groupId}/members にメンバー情報を追加
      const memberRef = groupRef.collection('members').doc(userId!)
      tx.set(memberRef, {
        userId: userId!,
        customerId,
        subscriptionId: subscription.id,
        status: subscription.status,
        planType,
        joinedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true })
    })

    // ========== 監査ログ ==========
    await logAudit({
      action: 'create_subscription_success',
      userId,
      groupId,
      subscriptionId: subscription.id,
      status: 'success',
      metadata: {
        planType,
        priceId,
        amount: price.unit_amount,
        duration: Date.now() - startTime,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      }
    })

    // ========== レスポンス ==========
    if (paymentIntent?.status === 'requires_action') {
      return NextResponse.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_action',
      })
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: paymentIntent?.client_secret ?? null,
    })

  } catch (err: any) {
    console.error('create-subscription error:', err)

    // 監査ログ
    if (userId) {
      await logAudit({
        action: 'create_subscription_error',
        userId,
        status: 'failed',
        error: err?.message || 'Unknown error',
        metadata: {
          type: err?.type,
          code: err?.code,
          duration: Date.now() - startTime,
        }
      })
    }

    // Stripeエラーの詳細な処理
    if (err.type === 'StripeCardError') {
      return NextResponse.json({
        error: 'SUB-P-003',
        message: err.message || 'Card error'
      }, { status: 402 })
    }

    if (err.type === 'StripeInvalidRequestError') {
      return NextResponse.json({
        error: 'SUB-S-001',
        message: err.message || 'Invalid request'
      }, { status: 400 })
    }

    if (err.type === 'StripeRateLimitError') {
      return NextResponse.json({
        error: 'SUB-S-008',
        message: 'Too many requests to Stripe'
      }, { status: 429 })
    }

    return NextResponse.json({
      error: 'GEN-001',
      message: err?.message || 'Failed to create subscription'
    }, { status: 500 })
  }
}