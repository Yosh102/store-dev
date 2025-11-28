import { Metadata } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp } from 'firebase-admin/app';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Firebase Admin の初期化
function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };

    initializeApp({
      credential: cert(serviceAccount as any)
    });
  }
  return getApp();
}

// 型チェックを緩和するため、引数を any として受け取る
export async function generateMetadata({ params }: any): Promise<Metadata> {
  try {
    getFirebaseAdmin();
    const db = getFirestore();
    
    // 商品データを取得
    const productDoc = await db.collection('products').doc(params.id).get();
    
    if (productDoc.exists) {
      const productData = productDoc.data();
      
      return {
        title: `${productData?.name} | PLAY TUNE オフィシャルサイト`,
        description: productData?.description || `${productData?.name}の商品詳細ページです。`,
        openGraph: {
          images: productData?.images && productData.images.length > 0 
            ? [productData.images[0]] 
            : []
        }
      };
    }
    
    return {
      title: '商品詳細 | PLAY TUNE オフィシャルサイト',
      description: 'PLAY TUNE オフィシャルストアの商品詳細ページです。',
    };
  } catch (error) {
    console.error('Error generating product metadata:', error);
    return {
      title: '商品詳細 | PLAY TUNE オフィシャルストア',
      description: 'PLAY TUNE オフィシャルストアの商品詳細ページです。',
    };
  }
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
