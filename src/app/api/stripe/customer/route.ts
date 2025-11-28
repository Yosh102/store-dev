// app/api/stripe/customer/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function POST(req: NextRequest) {
  try {
    // CSRF保護
    if (!verifyCSRFToken(req)) {
      await logCSRFFailure(req, '/api/stripe/customer', adminDb)
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
    console.log('✓ CSRF token verified')

    // 認証チェック
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'missing_token',
        message: 'Authorization header is missing' 
      }, { status: 401 })
    }

    const idToken = authHeader.slice('Bearer '.length)
    const decoded = await adminAuth.verifyIdToken(idToken).catch(() => null)
    if (!decoded?.uid) {
      return NextResponse.json({ 
        error: 'invalid_token',
        message: 'Invalid Firebase ID token' 
      }, { status: 401 })
    }

    const authenticatedUserId = decoded.uid
    const { userId, email } = await req.json()

    if (!userId || !email) {
      return NextResponse.json({ 
        error: 'missing_fields',
        message: 'User ID and email are required' 
      }, { status: 400 })
    }

    // リクエストのuserIdと認証済みuserIdが一致するか確認
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ 
        error: 'unauthorized',
        message: 'User ID does not match authenticated user' 
      }, { status: 403 })
    }

    // Firestoreから既存のstripeCustomerIdを確認
    const userDoc = await adminDb.collection('users').doc(userId).get()
    const userData = userDoc.data()
    
    // 既にstripeCustomerIdが保存されている場合
    if (userData?.stripeCustomerId) {
      try {
        // Stripeでそのcustomerが存在するか確認
        const existingCustomer = await stripe.customers.retrieve(userData.stripeCustomerId)
        if (!existingCustomer.deleted) {
          console.log('✓ Using existing Stripe customer:', existingCustomer.id)
          return NextResponse.json({ customer: existingCustomer })
        }
      } catch (e) {
        console.warn('Saved customer ID not found in Stripe, creating new one')
      }
    }

    // メールアドレスで既存顧客を検索
    const customers = await stripe.customers.list({ email: email, limit: 10 })
    
    // firebaseUserIdでフィルタリング
    const matchingCustomer = customers.data.find(
      c => c.metadata?.firebaseUserId === userId
    )

    let customer: Stripe.Customer

    if (matchingCustomer) {
      // 既存の一致する顧客を使用
      customer = matchingCustomer
      console.log('✓ Found existing Stripe customer:', customer.id)
    } else {
      // メールが一致するが別のfirebaseUserIdの顧客がいる場合でも新規作成
      // または、まったく顧客がいない場合は新規作成
      customer = await stripe.customers.create({
        email: email,
        metadata: { firebaseUserId: userId }
      })
      console.log('✓ Created new Stripe customer:', customer.id)
    }

    // Firestoreに保存
    await adminDb.collection('users').doc(userId).set({
      stripeCustomerId: customer.id,
      updatedAt: Timestamp.now(),
    }, { merge: true })
    console.log('✓ Saved stripeCustomerId to Firestore')

    return NextResponse.json({ customer })

  } catch (error) {
    console.error('Error creating or retrieving Stripe customer:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Failed to create or retrieve Stripe customer',
      details: errorMessage 
    }, { status: 500 })
  }
}