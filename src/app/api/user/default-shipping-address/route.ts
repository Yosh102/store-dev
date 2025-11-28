// /api/user/default-shipping-address/route.ts
import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

// Encryption configuration
// キーとIVのサイズを正規化する方法を使用
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-please-change-in-production';
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || 'default-iv-change';

// Encrypt data with normalized key and iv
function encrypt(text: string): string {
  try {
    // キーを32バイト(256ビット)に正規化
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    // IVを16バイト(128ビット)に正規化
    const iv = crypto.createHash('md5').update(String(ENCRYPTION_IV)).digest();
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

// Decrypt data with normalized key and iv
function decrypt(encryptedText: string): string {
  try {
    // キーを32バイト(256ビット)に正規化
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    // IVを16バイト(128ビット)に正規化
    const iv = crypto.createHash('md5').update(String(ENCRYPTION_IV)).digest();
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
}

// ユーザーが管理者かどうか確認する関数
async function isAdmin(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

async function verifyAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    return await adminAuth.verifyIdToken(token);
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// GET - デフォルト配送先住所を取得
export async function GET(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    
    // ユーザーのデフォルト配送先設定を取得
    const defaultShippingDoc = await adminDb
      .collection('defaultShippingAddresses')
      .doc(userId)
      .get();

    if (!defaultShippingDoc.exists) {
      return NextResponse.json({ 
        defaultAddressId: null,
        message: 'No default shipping address set' 
      });
    }

    const data = defaultShippingDoc.data();
    let defaultAddressId = null;

    // 暗号化されているかもしれないaddressIdを復号化
    if (data?.addressId) {
      try {
        defaultAddressId = decrypt(data.addressId);
      } catch (error) {
        console.error('Error decrypting address ID:', error);
        defaultAddressId = data.addressId; // 復号化に失敗した場合は元の値を使用
      }
    }

    // 実際に住所が存在するかチェック
    if (defaultAddressId) {
      const addressDoc = await adminDb
        .collection('addresses')
        .doc(defaultAddressId)
        .get();
      
      if (!addressDoc.exists || addressDoc.data()?.userId !== userId) {
        // 住所が存在しないか、他のユーザーの住所の場合はデフォルト設定を削除
        await adminDb
          .collection('defaultShippingAddresses')
          .doc(userId)
          .delete();
        
        return NextResponse.json({ 
          defaultAddressId: null,
          message: 'Default address no longer exists' 
        });
      }
    }

    return NextResponse.json({ 
      defaultAddressId,
      updatedAt: data?.updatedAt?.toDate(),
    });
  } catch (error) {
    console.error('Error fetching default shipping address:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch default shipping address' 
    }, { status: 500 });
  }
}

// POST - デフォルト配送先住所を設定
// POST - デフォルト配送先住所を設定（デバッグ版）
export async function POST(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // リクエストボディの取得とエラーハンドリング
    let body;
    try {
      const rawBody = await request.text();
      console.log('Raw request body:', rawBody); // デバッグログ追加
      
      body = JSON.parse(rawBody);
      console.log('Parsed body:', body); // デバッグログ追加
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body' 
      }, { status: 400 });
    }

    const { addressId } = body;
    console.log('Extracted addressId:', addressId); // デバッグログ追加

    if (!addressId) {
      console.log('addressId is missing or falsy:', addressId); // デバッグログ追加
      return NextResponse.json({ 
        error: 'Address ID is required' 
      }, { status: 400 });
    }

    // addressIdが文字列かどうか確認
    if (typeof addressId !== 'string') {
      console.log('addressId is not a string, type:', typeof addressId); // デバッグログ追加
      return NextResponse.json({ 
        error: 'Address ID must be a string' 
      }, { status: 400 });
    }

    // 指定された住所が存在し、ユーザーが所有していることを確認
    const addressDoc = await adminDb
      .collection('addresses')
      .doc(addressId)
      .get();

    if (!addressDoc.exists) {
      return NextResponse.json({ 
        error: 'Address not found' 
      }, { status: 404 });
    }

    const addressData = addressDoc.data();
    if (addressData?.userId !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized to set this address as default' 
      }, { status: 403 });
    }

    // addressIdを暗号化して保存
    let encryptedAddressId;
    try {
      encryptedAddressId = encrypt(addressId);
    } catch (error) {
      console.error('Error encrypting address ID:', error);
      encryptedAddressId = addressId;
    }

    // デフォルト配送先住所を設定（upsert操作）
    await adminDb
      .collection('defaultShippingAddresses')
      .doc(userId)
      .set({
        addressId: encryptedAddressId,
        userId: userId,
        updatedAt: Timestamp.now(),
        createdAt: Timestamp.now(),
      }, { merge: true });

    return NextResponse.json({ 
      message: 'Default shipping address set successfully',
      defaultAddressId: addressId 
    });
  } catch (error) {
    console.error('Error setting default shipping address:', error);
    return NextResponse.json({ 
      error: 'Failed to set default shipping address',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    }, { status: 500 });
  }
}

// DELETE - デフォルト配送先住所を解除
export async function DELETE(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    // デフォルト配送先設定を削除
    const defaultShippingRef = adminDb
      .collection('defaultShippingAddresses')
      .doc(userId);

    const defaultShippingDoc = await defaultShippingRef.get();
    
    if (!defaultShippingDoc.exists) {
      return NextResponse.json({ 
        message: 'No default shipping address was set' 
      });
    }

    await defaultShippingRef.delete();

    return NextResponse.json({ 
      message: 'Default shipping address removed successfully' 
    });
  } catch (error) {
    console.error('Error removing default shipping address:', error);
    return NextResponse.json({ 
      error: 'Failed to remove default shipping address',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
    }, { status: 500 });
  }
}