import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import Stripe from 'stripe'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  try {
    // ✅ CSRF保護
    if (!verifyCSRFToken(req)) {
      await logCSRFFailure(req, '/api/orders/cancel', adminDb)
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
    console.log('✓ CSRF token verified')

    // 認証確認
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.split('Bearer ')[1]
    const decodedToken = await admin.auth().verifyIdToken(token)
    const userId = decodedToken.uid

    const { orderId } = await req.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    // 注文を取得
    const orderDoc = await adminDb.collection('orders').doc(orderId).get()
    
    if (!orderDoc.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const orderData = orderDoc.data()
    
    // ユーザー権限チェック
    if (orderData?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized access to order' }, { status: 403 })
    }

    // キャンセル可能なステータスか確認
    const cancelableStatuses = ['pending', 'pending_paypay', 'pending_bank_transfer']
    if (!cancelableStatuses.includes(orderData?.status)) {
      return NextResponse.json({ 
        error: 'この注文はキャンセルできません。お問い合わせください。' 
      }, { status: 400 })
    }

    // Stripe PaymentIntentのキャンセル（存在する場合）
    try {
      if (orderData?.stripePaymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(orderData.stripePaymentIntentId)
        
        const cancelableStripeStatuses = [
          'requires_payment_method', 
          'requires_confirmation', 
          'requires_action', 
          'requires_capture'
        ]
        
        if (cancelableStripeStatuses.includes(paymentIntent.status)) {
          await stripe.paymentIntents.cancel(orderData.stripePaymentIntentId)
          console.log(`Stripe PaymentIntent canceled: ${orderData.stripePaymentIntentId}`)
        }
      }
    } catch (stripeError) {
      console.warn('Stripe cancellation failed:', stripeError)
      // Stripeのキャンセル失敗は続行（注文はキャンセル）
    }

    // 注文をキャンセル済みに更新
    await adminDb.collection('orders').doc(orderId).update({
      status: 'canceled',
      paymentStatus: 'canceled',
      canceledAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      cancelReason: 'user_requested'
    })

    console.log(`Order canceled: ${orderId} by user: ${userId}`)

    return NextResponse.json({
      success: true,
      message: '注文をキャンセルしました'
    })

  } catch (error: any) {
    console.error('Order cancellation error:', error)
    return NextResponse.json(
      { error: error.message || '注文のキャンセルに失敗しました' },
      { status: 500 }
    )
  }
}