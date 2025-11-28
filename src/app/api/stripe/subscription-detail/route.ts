import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');

    if (!subscriptionId) {
      return NextResponse.json({ error: 'サブスクリプションIDが必要です' }, { status: 400 });
    }

    // サブスクリプション情報を取得し、支払い方法情報も取得
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    });
    
    // 顧客の全支払い方法を取得
    const customerId = subscription.customer as string;
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return NextResponse.json({
      subscription,
      paymentMethods: paymentMethods.data
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'サブスクリプション情報の取得に失敗しました'
    }, { status: 500 });
  }
}