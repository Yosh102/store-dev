import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentIntent = searchParams.get('payment_intent');

  if (!paymentIntent) {
    return NextResponse.json({ error: 'Payment Intent ID is required' }, { status: 400 });
  }

  try {
    // クライアントシークレットから PaymentIntent ID を抽出
    const paymentIntentId = paymentIntent.split('_secret_')[0];
    
    const paymentIntentData = await stripe.paymentIntents.retrieve(paymentIntentId);
    const { amount, created, metadata } = paymentIntentData;

    // Firestoreから注文詳細を取得（オプション情報を含む）
    let orderFromDb = null;
    try {
      const orderDoc = await adminDb.collection('orders').doc(paymentIntentId).get();
      if (orderDoc.exists) {
        orderFromDb = orderDoc.data();
      }
    } catch (dbError) {
      console.warn('Failed to fetch order from Firestore:', dbError);
    }

    // アドレス情報を取得
    const addressId = metadata.addressId;
    const address = metadata.address 
      ? JSON.parse(metadata.address) 
      : await fetchAddressDetails(addressId);

    // アイテム情報を取得（オプション情報を含む）
    let items = [];
    if (orderFromDb && orderFromDb.items) {
      // Firestoreから詳細なアイテム情報を取得
      items = orderFromDb.items;
    } else if (metadata.items) {
      // メタデータからアイテム情報を取得（フォールバック）
      try {
        items = JSON.parse(metadata.items);
      } catch (parseError) {
        console.warn('Failed to parse items from metadata:', parseError);
        items = [];
      }
    }

    const orderDetails = {
      id: paymentIntentData.id,
      amount,
      created,
      status: paymentIntentData.status,
      items: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        images: item.images || [],
        selectedOptions: item.selectedOptions || [],
        // オプション情報を文字列として整形
        optionsText: item.selectedOptions 
          ? item.selectedOptions.map((opt: any) => `${opt.optionName}: ${opt.valueName}`).join(', ')
          : ''
      })),
      subtotal: orderFromDb?.subtotal || (amount - 800), // 送料を除いた小計
      shippingFee: orderFromDb?.shippingFee || 800,
      total: amount,
      shippingAddress: address 
        ? `${address.postalCode || ''} ${address.prefecture || ''}${address.city || ''}${address.line1 || ''} ${address.line2 || ''}`.trim()
        : '住所情報なし',
      orderDate: new Date(created * 1000).toLocaleString('ja-JP'),
    };

    return NextResponse.json(orderDetails);
  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch order details' 
    }, { status: 500 });
  }
}

// Mock function for address details (addressIdが指定された場合のフォールバック)
async function fetchAddressDetails(addressId: string) {
  if (!addressId) {
    return null;
  }

  try {
    // 実際の実装では、ユーザーの保存された住所情報を取得
    // const addressDoc = await adminDb.collection('addresses').doc(addressId).get();
    // if (addressDoc.exists) {
    //   return addressDoc.data();
    // }
    
    // Mock address data (実際の実装では削除)
    const mockAddress = {
      postalCode: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      line1: '千代田1-1-1',
      line2: 'アパート101',
    };

    return mockAddress;
  } catch (error) {
    console.error('Error fetching address details:', error);
    return null;
  }
}