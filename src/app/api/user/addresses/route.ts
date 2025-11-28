// /api/user/addresses/route.ts
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
    // エラーが発生した場合は元のテキストを返す
    // 注意: 本番環境ではエラーハンドリングを改善してください
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
    // エラーが発生した場合は元のテキストを返す
    // 注意: データが実際に暗号化されていない場合に有用
    return encryptedText;
  }
}

// Encrypt an address object
function encryptAddress(address: any): any {
  const encryptedAddress = { ...address };
  
  // Fields to encrypt
  const sensitiveFields = [
    'postalCode', 'prefecture', 'city', 'line1', 'line2', 
    'phoneNumber', 'name'
  ];
  
  sensitiveFields.forEach(field => {
    if (encryptedAddress[field]) {
      try {
        encryptedAddress[field] = encrypt(encryptedAddress[field]);
      } catch (error) {
        console.error(`Error encrypting field ${field}:`, error);
        // Keep original value if encryption fails
      }
    }
  });
  
  return encryptedAddress;
}

// Decrypt an address object
function decryptAddress(encryptedAddress: any): any {
  const address = { ...encryptedAddress };
  
  // Fields to decrypt
  const sensitiveFields = [
    'postalCode', 'prefecture', 'city', 'line1', 'line2', 
    'phoneNumber', 'name'
  ];
  
  sensitiveFields.forEach(field => {
    if (address[field]) {
      try {
        address[field] = decrypt(address[field]);
      } catch (error) {
        console.error(`Error decrypting field ${field}:`, error);
        // Keep original value if decryption fails
      }
    }
  });
  
  return address;
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

export async function GET(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    
    // ユーザーが管理者かどうかチェック
    const adminUser = await isAdmin(userId);
    
    let addressesQuery;
    if (adminUser) {
      // 管理者は全ての住所を取得可能
      addressesQuery = adminDb.collection('addresses');
    } else {
      // 一般ユーザーは自分の住所のみ取得可能
      addressesQuery = adminDb
        .collection('addresses')
        .where('userId', '==', userId);
    }
    
    const addressesSnapshot = await addressesQuery.get();
    
    // 復号化して返す
    const addresses = addressesSnapshot.docs.map(doc => {
      const encryptedData = doc.data();
      let decryptedData;
      
      try {
        decryptedData = decryptAddress(encryptedData);
      } catch (error) {
        console.error('Error decrypting address:', error);
        decryptedData = encryptedData;
      }
      
      // ★ ここが重要：ドキュメントIDを使用し、データ内のidフィールドは無視
      return {
        id: doc.id, // ← FirestoreのドキュメントIDを使用
        name: decryptedData.name,
        postalCode: decryptedData.postalCode,
        prefecture: decryptedData.prefecture,
        city: decryptedData.city,
        line1: decryptedData.line1,
        line2: decryptedData.line2,
        phoneNumber: decryptedData.phoneNumber,
        userId: decryptedData.userId,
        createdAt: decryptedData.createdAt,
        updatedAt: decryptedData.updatedAt,
        // データ内のidフィールドは除外（混乱を避けるため）
      };
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { address } = await request.json();
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    // 管理者かどうかをチェック
    const adminUser = await isAdmin(userId);
    
    // 管理者でなく、かつ他のユーザーの住所を追加しようとしている場合は拒否
    if (!adminUser && address.userId && address.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to add address for other users' }, { status: 403 });
    }
    
    // 実際に保存するユーザーID（管理者が他のユーザー用に追加する場合に対応）
    const targetUserId = (adminUser && address.userId) ? address.userId : userId;

    // Encrypt sensitive address data before storing
    let encryptedAddress;
    try {
      encryptedAddress = encryptAddress(address);
    } catch (error) {
      console.error('Error encrypting address:', error);
      encryptedAddress = address;
    }

    // ★ データ内のidフィールドは保存しない
    const { id, ...addressWithoutId } = encryptedAddress;

    const docRef = await adminDb.collection('addresses').add({
      ...addressWithoutId,
      userId: targetUserId, // Keep user ID unencrypted for queries
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId // 追加した人のIDも記録
    });

    // Return decrypted address to client with document ID
    const addedAddress = {
      id: docRef.id, // ← ドキュメントIDを使用
      name: address.name,
      postalCode: address.postalCode,
      prefecture: address.prefecture,
      city: address.city,
      line1: address.line1,
      line2: address.line2,
      phoneNumber: address.phoneNumber,
      userId: targetUserId,
    };

    return NextResponse.json({ 
      message: 'Address added successfully',
      address: addedAddress 
    });
  } catch (error) {
    console.error('Error adding address:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to add address' 
    }, { status: 500 });
  }
}


export async function PUT(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { addressId, address } = await request.json();
    
    if (!addressId || !address) {
      return NextResponse.json({ error: 'Address ID and data are required' }, { status: 400 });
    }

    const addressRef = adminDb.collection('addresses').doc(addressId);
    const addressDoc = await addressRef.get();

    if (!addressDoc.exists) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // 管理者かどうかをチェック
    const adminUser = await isAdmin(userId);
    
    // 管理者でなく、かつ自分の住所でない場合は更新を拒否
    if (!adminUser && addressDoc.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to update this address' }, { status: 403 });
    }

    // Encrypt sensitive address data before updating
    let encryptedAddress;
    try {
      encryptedAddress = encryptAddress(address);
    } catch (error) {
      console.error('Error encrypting address:', error);
      encryptedAddress = address;
    }

    // ★ データ内のidフィールドは更新しない
    const { id, ...addressWithoutId } = encryptedAddress;

    await addressRef.update({
      ...addressWithoutId,
      updatedAt: Timestamp.now(),
      updatedBy: userId // 更新した人のIDも記録
    });

    return NextResponse.json({ 
      message: 'Address updated successfully',
      address: {
        id: addressId, // ← ドキュメントIDを使用
        name: address.name,
        postalCode: address.postalCode,
        prefecture: address.prefecture,
        city: address.city,
        line1: address.line1,
        line2: address.line2,
        phoneNumber: address.phoneNumber,
        userId: address.userId,
      }
    });
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to update address' 
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const decodedToken = await verifyAuth(request);
    if (!decodedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { addressId } = await request.json();
    if (!addressId) {
      return NextResponse.json({ error: 'Address ID is required' }, { status: 400 });
    }

    const addressRef = adminDb.collection('addresses').doc(addressId);
    const addressDoc = await addressRef.get();

    if (!addressDoc.exists) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // 管理者かどうかをチェック
    const adminUser = await isAdmin(userId);
    
    // 管理者でなく、かつ自分の住所でない場合は削除を拒否
    if (!adminUser && addressDoc.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this address' }, { status: 403 });
    }

    await addressRef.delete();

    return NextResponse.json({ message: 'Address removed successfully' });
  } catch (error) {
    console.error('Error removing address:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to remove address' 
    }, { status: 500 });
  }
}