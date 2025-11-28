import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: Request) {
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

    const { subscriptionId, paymentMethodId } = await request.json();

    if (!subscriptionId || !paymentMethodId) {
      return NextResponse.json({ error: '必須パラメータが不足しています' }, { status: 400 });
    }

    // ユーザーが本当にこのサブスクリプションの所有者かどうかを確認
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptions = userData?.subscriptions || {};
    
    // サブスクリプションIDと一致するエントリがあるか確認
    let ownsSubscription = false;
    let groupId = '';
    
    for (const [gId, subscription] of Object.entries(subscriptions)) {
      if ((subscription as any).id === subscriptionId) {
        ownsSubscription = true;
        groupId = gId;
        break;
      }
    }
    
    if (!ownsSubscription) {
      return NextResponse.json({ error: 'このサブスクリプションを変更する権限がありません' }, { status: 403 });
    }

    // サブスクリプション情報を取得して顧客IDを確認
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = subscription.customer as string;

    // 指定された支払い方法が顧客に紐付いているか確認
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    const isValidPaymentMethod = paymentMethods.data.some(pm => pm.id === paymentMethodId);
    
    if (!isValidPaymentMethod) {
      // 紐付いていない場合は紐付ける
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
      } catch (error) {
        console.error('Error attaching payment method to customer:', error);
        return NextResponse.json({ 
          error: '支払い方法の紐付けに失敗しました'
        }, { status: 400 });
      }
    }

    // サブスクリプションの支払い方法を更新
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });

    // 更新されたサブスクリプション情報を返す
    return NextResponse.json({ 
      success: true,
      subscription: updatedSubscription
    });
  } catch (error) {
    console.error('Error updating subscription payment method:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'サブスクリプションの支払い方法の更新に失敗しました'
    }, { status: 500 });
  }
}