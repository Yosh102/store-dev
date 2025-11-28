import { Metadata, Viewport } from "next"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { Suspense } from "react"
import GroupLayoutClient from "./GroupLayoutClient"
import Footer from "@/components/Footer"
import { headers } from 'next/headers'

type GroupSlugPageProps = {
  params: Promise<{
    slug: string
  }>
}

// viewport設定を分離
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

// サブページのタイトル設定
const getSubPageTitle = (subPage: string, groupName: string): { title: string, description: string } => {
  const subPageConfigs: { [key: string]: { title: string, description: string } } = {
    'discography': {
      title: `DISCOGRAPHY | ${groupName}オフィシャルサイト`,
      description: `${groupName}の楽曲・ディスコグラフィー情報をご覧いただけます。`
    },
    'membership': {
      title: `MEMBERSHIP | ${groupName}オフィシャルサイト`,
      description: `${groupName}のメンバーシップ情報をご覧いただけます。`
    },
    'staff': {
      title: `STAFF DIARY | ${groupName}オフィシャルサイト`,
      description: `${groupName}のスタッフダイアリーをご覧いただけます。`
    },
    'mypage': {
      title: `MYPAGE | ${groupName} MEMBERSHIP`,
      description: `${groupName}メンバーシップのマイページです。`
    },
    'posts': {
      title: `メンバーブログ | ${groupName}オフィシャルサイト`,
      description: `${groupName}メンバーのブログ記事をご覧いただけます。`
    },
    'news': {
      title: `お知らせ | ${groupName}オフィシャルサイト`,
      description: `${groupName}の最新お知らせをご覧いただけます。`
    },
    'profile': {
      title: `PROFILE | ${groupName}オフィシャルサイト`,
      description: `${groupName}のプロフィール情報をご覧いただけます。`
    },
    'settings': {
      title: `SETTINGS | ${groupName}オフィシャルサイト`,
      description: `${groupName}の設定ページです。`
    }
  }

  return subPageConfigs[subPage] || {
    title: `${groupName}オフィシャルサイト`,
    description: `${groupName}オフィシャルサイトです。`
  }
}

export async function generateMetadata({ params }: GroupSlugPageProps): Promise<Metadata> {
  const { slug } = await params
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  try {
    // Firestore からグループ情報を取得
    const groupsRef = collection(db, "groups");
    const q = query(groupsRef, where("slug", "==", slug));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const groupData = querySnapshot.docs[0].data();
      const groupName = groupData.name;
      
      // パスからサブページを特定
      const pathSegments = pathname.split('/');
      const subPage = pathSegments[pathSegments.length - 1]; // 最後のセグメントを取得
      
      // グループのトップページかどうかチェック
      const isGroupTopPage = pathname === `/group/${slug}` || pathname === `/group/${slug}/`;
      
      if (isGroupTopPage) {
        // グループのトップページの場合
        return {
          title: `${groupName} | PLAY TUNE オフィシャルサイト`,
          description: groupData.introduction || 'PLAY TUNE オフィシャルサイトのタレントページです。',
          openGraph: {
            title: `${groupName} | PLAY TUNE オフィシャルサイト`,
            description: groupData.introduction || 'PLAY TUNE オフィシャルサイトのタレントページです。',
            images: [groupData.coverImage || '/images/default-cover.jpg'],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            title: `${groupName} | PLAY TUNE オフィシャルサイト`,
            description: groupData.introduction || 'PLAY TUNE オフィシャルサイトのタレントページです。',
            images: [groupData.coverImage || '/images/default-cover.jpg'],
          },
          robots: {
            index: true,
            follow: true,
          },
        };
      } else {
        // サブページの場合
        const { title, description } = getSubPageTitle(subPage, groupName);
        
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            images: [groupData.coverImage || '/images/default-cover.jpg'],
            type: 'website',
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [groupData.coverImage || '/images/default-cover.jpg'],
          },
          robots: {
            index: true,
            follow: true,
          },
        };
      }
    }

    // グループが見つからない場合はデフォルトのメタデータを返す
    return {
      title: 'タレント | PLAY TUNE オフィシャルサイト',
      description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
      openGraph: {
        title: 'タレント | PLAY TUNE オフィシャルサイト',
        description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
        images: ['/images/default-cover.jpg'],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'タレント | PLAY TUNE オフィシャルサイト',
        description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
        images: ['/images/default-cover.jpg'],
      }
    };
  } catch (error) {
    console.error('Error fetching group metadata:', error);
    // エラーが発生した場合もデフォルトのメタデータを返す
    return {
      title: 'タレント | PLAY TUNE オフィシャルサイト',
      description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
      openGraph: {
        title: 'タレント | PLAY TUNE オフィシャルサイト',
        description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
        images: ['/images/default-cover.jpg'],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'タレント | PLAY TUNE オフィシャルサイト',
        description: 'PLAY TUNE オフィシャルサイトのタレントページです。',
        images: ['/images/default-cover.jpg'],
      }
    };
  }
}

interface GroupSlugLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    slug: string;
  }>;
}

// クライアントサイドでページ判定を行うコンポーネント
function PageContentWrapper({ children, slug }: { children: React.ReactNode, slug: string }) {
  if (typeof window === 'undefined') {
    // サーバーサイドでは常にマージンなし（Hydration対策）
    return <div className="group-page-content">{children}</div>
  }

  // クライアントサイドでページ判定
  const isGroupTopPage = window.location.pathname === `/group/${slug}`
  
  return (
    <div className={`group-page-content ${!isGroupTopPage ? 'pt-16' : ''}`}>
      {children}
    </div>
  )
}

export default async function GroupSlugLayout({ children, params }: GroupSlugLayoutProps) {
  const { slug } = await params

  return (
    <div className="group-slug-layout min-h-screen">
        <Suspense fallback={
        <div className="min-h-screen bg-black flex items-center justify-center pt-16">
            <div className="flex flex-col items-center space-y-6">
            {/* シンプルなロゴプレースホルダー */}
            <div className="relative w-20 h-20">
                <div className="w-full h-full bg-gray-700 rounded-full animate-[fade_2s_infinite] opacity-50 flex items-center justify-center">
                <span className="text-white text-xs font-bold">LOGO</span>
                </div>
            </div>
            
            {/* Loadingインジケーター */}
            <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '200ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '400ms' }}></div>
                </div>
                <span className="text-white text-xs font-medium ml-2">Loading...</span>
            </div>
            </div>
            
            {/* カスタムアニメーション */}
            <style dangerouslySetInnerHTML={{
            __html: `
                @keyframes fade {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 0.8; }
                }
            `
            }} />
        </div>
        }>
        <GroupLayoutClient slug={slug}>
            <PageContentWrapper slug={slug}>
            {children}
            </PageContentWrapper>
        </GroupLayoutClient>
        <Footer />
        </Suspense>
    </div>
  );
}