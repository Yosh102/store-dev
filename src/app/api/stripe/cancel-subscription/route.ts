import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import * as admin from 'firebase-admin'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  try {
    // ✅ CSRF保護
    if (!verifyCSRFToken(req)) {
      await logCSRFFailure(req, '/api/stripe/cancel-subscription', adminDb)
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
    console.log('✓ CSRF token verified')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.split('Bearer ')[1]
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token)
    const userId = decodedToken.uid
    const { subscriptionId, cancelAtPeriodEnd } = await req.json()

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 })
    }

    const userRef = adminDb.collection('users').doc(userId)
    const userDoc = await userRef.get()
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = userDoc.data()
    const subscriptions = userData?.subscriptions || {}
    
    let userOwnsSubscription = false
    let groupId = null
    
    for (const [gId, subscription] of Object.entries(subscriptions)) {
      if ((subscription as any).id === subscriptionId) {
        userOwnsSubscription = true
        groupId = gId
        break
      }
    }
    
    if (!userOwnsSubscription) {
      return NextResponse.json({ error: 'Subscription not found for this user' }, { status: 404 })
    }

    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd === true,
    })

    if (groupId) {
      await userRef.update({
        [`subscriptions.${groupId}.cancelAtPeriodEnd`]: cancelAtPeriodEnd === true,
      })
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end * 1000,
      }
    })

  } catch (error) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    }, { status: 500 })
  }
}