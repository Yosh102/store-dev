// /api/stripe/verify-subscription/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb, adminAuth } from '@/lib/firebase-admin' // ★ verifyIdToken 用

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function GET(request: Request) {
  try {
    // ---- Authorization: Bearer <ID_TOKEN> の検証 ----
    const authz = request.headers.get('authorization') || ''
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let uid: string
    try {
      const decoded = await adminAuth.verifyIdToken(token)
      uid = decoded.uid
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // ---- 入力 ----
    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscription_id')
    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    // ---- Stripe: サブスク取得 ----
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // ---- Stripe: カスタマー取得 & 所有者チェック ----
    const customerId = subscription.customer as string
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer || (customer as any).deleted) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Customer.metadata.firebaseUserId と一致必須
    const ownerUid = (customer as Stripe.Customer).metadata?.firebaseUserId
    if (!ownerUid) {
      return NextResponse.json({ error: 'Customer metadata missing' }, { status: 409 })
    }
    if (ownerUid !== uid) {
      // 他人の subscription を覗くのを防止
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ---- Firestore 整合性（任意強化）: users/{uid} にこの subscription があるか ----
    const userRef = adminDb.collection('users').doc(uid)
    const userDoc = await userRef.get()
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User document not found' }, { status: 404 })
    }

    const userData = userDoc.data() || {}
    const subscriptions = userData.subscriptions || {}

    // subscriptions のどれかに id が一致するか
    const subscriptionDetails = Object.values(subscriptions).find(
      (sub: any) => sub?.id === subscriptionId
    ) as { planType?: 'monthly' | 'yearly' } | undefined

    if (!subscriptionDetails) {
      // Firestore にはまだ反映されていない or 別ユーザーのもの
      // （セキュリティ上は 404 で OK。存在漏洩を防ぐ）
      return NextResponse.json({ error: 'Subscription details not found' }, { status: 404 })
    }

    // ---- レスポンス ----
    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status, // 'active' | 'past_due' | 'incomplete' | ...
        planType: subscriptionDetails.planType ?? null,
        currentPeriodEnd: subscription.current_period_end * 1000,
        customer: {
          id: customerId,
          email: (customer as Stripe.Customer).email ?? null,
        },
      },
    })
  } catch (error) {
    console.error('Error verifying subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify subscription' },
      { status: 500 }
    )
  }
}
