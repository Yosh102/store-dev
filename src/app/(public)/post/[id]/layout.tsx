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
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount as any)
    });
  }
  return getApp();
}

// 型チェックを緩和するため、引数を any にキャスト
export async function generateMetadata({ params }: any): Promise<Metadata> {
  const { id } = params; // id は直接オブジェクトとして扱える前提
  try {
    getFirebaseAdmin();
    const db = getFirestore();
    
    // 投稿データを取得
    const postDoc = await db.collection('posts').doc(id).get();
    
    if (postDoc.exists) {
      const postData = postDoc.data();
      
      return {
        title: `${postData?.title} | PLAY TUNE オフィシャルストア`,
        description: postData?.excerpt || `${postData?.title}の詳細ページです。`,
        openGraph: {
          images: postData?.thumbnailUrl ? [postData.thumbnailUrl] : [],
        },
      };
    }
    
    // 投稿が見つからない場合のフォールバック
    return {
      title: '記事 | PLAY TUNE オフィシャルサイト',
      description: 'PLAY TUNE オフィシャルサイトの記事ページです。',
    };
  } catch (error) {
    console.error('Error generating post metadata:', error);
    return {
      title: '記事 | PLAY TUNE オフィシャルサイト',
      description: 'PLAY TUNE オフィシャルサイトの記事ページです。',
    };
  }
}

export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
