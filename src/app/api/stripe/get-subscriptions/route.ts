import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET(request: Request) {
  try {
    // Firebaseの認証情報を取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // トークンを検証しユーザーIDを取得
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // クエリパラメータからsubscriptionIdを取得（特定のサブスクリプション詳細を取得する場合）
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    // Firestoreからユーザー情報を取得
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    
    // 特定のサブスクリプションのみを取得する場合
    if (subscriptionId) {
      // Stripeからサブスクリプション情報を取得（支払い方法情報を含む）
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method', 'customer'],
      });
      
      // 顧客IDを取得
      const customerId = stripeSubscription.customer as string;
      
      // この顧客の全支払い方法を取得
      const paymentMethodsResponse = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      // ユーザーのSubscriptionからグループIDを検索
      const subscriptions = userData?.subscriptions || {};
      let groupId = '';
      let groupData = null;
      
      // サブスクリプションIDに一致するエントリを検索
      for (const [gId, subscription] of Object.entries(subscriptions)) {
        if ((subscription as any).id === subscriptionId) {
          groupId = gId;
          break;
        }
      }
      
      // グループ情報を取得
      if (groupId) {
        const groupRef = adminDb.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        groupData = groupDoc.exists ? groupDoc.data() : null;
      }

      return NextResponse.json({
        subscription: {
          ...stripeSubscription,
          groupId,
          groupName: groupData?.name || 'Unknown Group',
          groupImageUrl: groupData?.imageUrl || null,
          planType: (subscriptions[groupId] as any)?.planType || 'monthly',
          nextBillingDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
        },
        paymentMethods: paymentMethodsResponse.data
      });
    } 
    // 全サブスクリプションを取得する場合（既存の処理を維持）
    else {
      const subscriptions = userData?.subscriptions || {};
      
      // 各サブスクリプションの詳細情報を取得
      const subscriptionDetails = [];
      
      for (const [groupId, subscription] of Object.entries(subscriptions)) {
        // グループ情報を取得
        const groupRef = adminDb.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        const groupData = groupDoc.exists ? groupDoc.data() : null;
        
        // Stripeからサブスクリプション情報を取得して最新状態を確認
        const stripeSubscription = await stripe.subscriptions.retrieve(
          (subscription as any).id,
          { expand: ['default_payment_method'] }
        );
        
        subscriptionDetails.push({
          groupId,
          groupName: groupData?.name || 'Unknown Group',
          groupImageUrl: groupData?.imageUrl || null,
          subscriptionId: (subscription as any).id,
          status: stripeSubscription.status,
          planType: (subscription as any).planType,
          currentPeriodEnd: stripeSubscription.current_period_end * 1000, // Unix timestamp to milliseconds
          nextBillingDate: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          defaultPaymentMethod: stripeSubscription.default_payment_method,
        });
      }

      return NextResponse.json({ subscriptions: subscriptionDetails });
    }
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch subscription details'
    }, { status: 500 });
  }
}