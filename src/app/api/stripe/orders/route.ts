// api/stripe/orders/route.ts の修正版
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

// Stripeの初期化
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET(request: Request) {
  try {
    // Firebaseの認証情報を取得（ヘッダーから）
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
    
    // ユーザーのStripeカスタマーIDを取得 (Firestoreから)
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const userData = userDoc.data();
    const stripeCustomerId = userData?.customerId;
    
    if (!stripeCustomerId) {
      return NextResponse.json({ orders: [] }); // カスタマーIDがなければ空の配列を返す
    }
    
    // Stripeから支払い履歴を取得
    const paymentIntents = await stripe.paymentIntents.list({
      customer: stripeCustomerId,
      limit: 50, // 最大50件取得
    });
    
    // チャージ情報も取得（より詳細な情報が必要な場合）
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 50,
    });
    
    // 注文情報としてフォーマット
    const orders = paymentIntents.data.map(payment => {
      // 関連するチャージを見つける
      const relatedCharge = charges.data.find(charge => 
        charge.payment_intent === payment.id
      );
      
      // メタデータから商品情報を抽出
      const items = payment.metadata.items 
        ? JSON.parse(payment.metadata.items) 
        : [];
      
      // PayPay決済の判定
      const isPayPayPayment = payment.metadata.paymentType === 'paypay' || 
                             payment.metadata.provider?.includes('paypay')
      
      // 注文オブジェクトを構築
      return {
        id: payment.id,
        userId: userId,
        items: items,
        total: payment.amount / 100, // セント -> 円
        subtotal: payment.amount / 100, // シッピング情報がない場合考慮
        shippingFee: 0, // デフォルト値
        status: mapPaymentStatusToOrderStatus(payment.status, payment.metadata.paymentType),
        paymentStatus: payment.status,
        paymentType: payment.metadata.paymentType || 'card', // PayPay情報を含める
        createdAt: new Date(payment.created * 1000), // UnixタイムスタンプをDateに変換
        updatedAt: payment.canceled_at 
          ? new Date(payment.canceled_at * 1000) 
          : new Date(payment.created * 1000),
        shippingInfo: payment.shipping ? {
          name: payment.shipping.name,
          address: payment.shipping.address?.line1,
          city: payment.shipping.address?.city,
          postalCode: payment.shipping.address?.postal_code,
          prefecture: payment.shipping.address?.state,
        } : undefined,
        trackingNumber: payment.metadata.tracking_number,
        paymentMethod: isPayPayPayment ? {
          type: 'paypay',
        } : relatedCharge ? {
          type: relatedCharge.payment_method_details?.type || 'card',
          last4: relatedCharge.payment_method_details?.card?.last4,
          brand: relatedCharge.payment_method_details?.card?.brand,
        } : undefined,
        provider: payment.metadata.provider, // PayPay プロバイダー情報
        hostedInstructionsUrl: payment.metadata.hostedInstructionsUrl, // 銀行振込用
      };
    });
    
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('注文履歴の取得中にエラーが発生しました:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '注文履歴の取得に失敗しました'
    }, { status: 500 });
  }
}

// Stripeの支払いステータスを注文ステータスにマッピング（PayPay対応版）
function mapPaymentStatusToOrderStatus(
  paymentStatus: string, 
  paymentType?: string
): 'pending' | 'processing' | 'shipped' | 'delivered' | 'canceled' | 'pending_paypay' | 'pending_bank_transfer' {
  
  // PayPay決済の場合
  if (paymentType === 'paypay') {
    switch (paymentStatus) {
      case 'succeeded':
        return 'processing'; // PayPay決済成功 → 処理中
      case 'processing':
        return 'pending_paypay'; // PayPay処理中 → PayPay決済待ち
      case 'requires_action':
      case 'requires_confirmation':
        return 'pending_paypay'; // PayPay決済待ち
      case 'canceled':
        return 'canceled'; // キャンセル
      default:
        return 'pending_paypay'; // その他 → PayPay決済待ち
    }
  }
  
  // 銀行振込の場合
  if (paymentType === 'bank_transfer') {
    switch (paymentStatus) {
      case 'succeeded':
        return 'processing'; // 振込確認済み → 処理中
      case 'requires_action':
      case 'requires_confirmation':
      case 'processing':
        return 'pending_bank_transfer'; // 振込待ち
      case 'canceled':
        return 'canceled'; // キャンセル
      default:
        return 'pending_bank_transfer'; // その他 → 振込待ち
    }
  }
  
  // カード決済（従来通り）
  switch (paymentStatus) {
    case 'succeeded':
      return 'processing'; // 支払い成功 → 処理中
    case 'processing':
      return 'pending'; // 処理中 → 保留中
    case 'canceled':
      return 'canceled'; // キャンセル
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'requires_capture':
      return 'pending'; // 各種要求状態 → 保留中
    default:
      return 'pending'; // その他 → 保留中
  }
}