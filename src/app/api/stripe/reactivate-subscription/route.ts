import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
  try {
    // Firebaseの認証情報を取得（セッションからではなく）
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // トークンを検証しユーザーIDを取得
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID is required' }, { status: 400 });
    }

    // ユーザーがこのサブスクリプションの所有者であることを確認
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptions = userData?.subscriptions || {};
    
    // サブスクリプションがこのユーザーに属しているか確認
    let userOwnsSubscription = false;
    let groupId = null;
    
    for (const [gId, subscription] of Object.entries(subscriptions)) {
      if ((subscription as any).id === subscriptionId) {
        userOwnsSubscription = true;
        groupId = gId;
        break;
      }
    }
    
    if (!userOwnsSubscription) {
      return NextResponse.json({ error: 'Subscription not found for this user' }, { status: 404 });
    }

    // 現在キャンセル予定のサブスクリプションを再有効化
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    // Firestoreの更新
    if (groupId) {
      await userRef.update({
        [`subscriptions.${groupId}.cancelAtPeriodEnd`]: false,
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: updatedSubscription.current_period_end * 1000,
      }
    });

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
    }, { status: 500 });
  }
}