import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'
import { adminDb } from '@/lib/firebase-admin'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  try {
    // ✅ CSRF保護
    if (!verifyCSRFToken(req)) {
      await logCSRFFailure(req, '/api/stripe/delete-payment-method', adminDb)
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
    console.log('✓ CSRF token verified')

    const { paymentMethodId, customerId } = await req.json()

    if (!paymentMethodId || !customerId) {
      return NextResponse.json({ error: 'Payment method ID and customer ID are required' }, { status: 400 })
    }

    // 決済方法を削除
    await stripe.paymentMethods.detach(paymentMethodId)
    
    // 更新された決済方法一覧を取得
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    return NextResponse.json({ success: true, paymentMethods: paymentMethods.data })
  } catch (error) {
    console.error('Error deleting payment method:', error)
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
  }
}