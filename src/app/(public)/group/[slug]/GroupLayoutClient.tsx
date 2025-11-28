"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { useAuth } from "@/context/auth-context"
import GroupNavbar from "@/components/group/GroupNavbar"
import Image from "next/image"
import type { Group } from "@/types/group"

interface GroupLayoutClientProps {
  children: React.ReactNode;
  slug: string;
}

// グループロゴスケルトンコンポーネント
const GroupLogoSkeleton = ({ group }: { group: Group | null }) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  
  if (!group?.logoUrl) {
    // ロゴがない場合は名前のスケルトン
    return (
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="w-32 h-32 bg-gray-800 rounded-full animate-pulse"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded-full"></div>
        </div>
        <div className="text-center space-y-2">
          <div className="relative">
            <div className="h-8 bg-gray-800 rounded w-48 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded"></div>
          </div>
          <div className="relative">
            <div className="h-4 bg-gray-800 rounded w-32 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="relative w-32 h-32">
        {/* スケルトンアニメーション */}
        <div className={`absolute inset-0 bg-gray-800 rounded-lg animate-pulse transition-opacity duration-300 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded-lg"></div>
        </div>
        
        {/* 実際のロゴ */}
        <Image
          src={group.logoUrl}
          alt={`${group.name} ロゴ`}
          fill
          className={`object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          priority
        />
      </div>
      
      {/* グループ名のスケルトン */}
      <div className="text-center space-y-2">
        <div className="relative">
          <div className={`h-8 bg-gray-800 rounded w-48 animate-pulse transition-opacity duration-300 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded"></div>
          </div>
          <h1 className={`text-2xl font-bold text-white transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} absolute inset-0 flex items-center justify-center`}>
            {group.name}
          </h1>
        </div>
        <div className="relative">
          <div className={`h-4 bg-gray-800 rounded w-32 animate-pulse transition-opacity duration-300 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600 to-transparent animate-shimmer rounded"></div>
          </div>
          <p className={`text-gray-400 transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'} absolute inset-0 flex items-center justify-center`}>
            Loading...
          </p>
        </div>
      </div>
    </div>
  )
}

export default function GroupLayoutClient({ children, slug }: GroupLayoutClientProps) {
  const { user } = useAuth()
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const groupsRef = collection(db, "groups")
        const q = query(groupsRef, where("slug", "==", slug))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const groupDoc = querySnapshot.docs[0]
          const groupData = groupDoc.data()
          const groupWithId = {
            id: groupDoc.id,
            ...groupData,
          } as Group
          setGroup(groupWithId)
        }
      } catch (error) {
        console.error("Error fetching group:", error)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchGroup()
    }
  }, [slug])

  // カスタムCSSの動的適用
  useEffect(() => {
    if (group) {
      // グループのテーマカラーを適用
      const root = document.documentElement
      
      if (group.accentColor) {
        root.style.setProperty('--group-accent-color', group.accentColor)
      }
      
      if (group.backgroundColor) {
        root.style.setProperty('--group-bg-color', group.backgroundColor)
      }
      
      if (group.textColor) {
        root.style.setProperty('--group-text-color', group.textColor)
      }

      // カスタムCSSの追加
      if (group.customCSS) {
        const styleElement = document.createElement('style')
        styleElement.id = `group-custom-css-${group.id}`
        styleElement.textContent = group.customCSS
        document.head.appendChild(styleElement)

        // クリーンアップ用の返り値
        return () => {
          const existingStyle = document.getElementById(`group-custom-css-${group.id}`)
          if (existingStyle) {
            document.head.removeChild(existingStyle)
          }
        }
      }
    }
  }, [group])

  // [slug]ページ専用のボディクラス管理
  useEffect(() => {
    // ボディにクラスを追加
    document.body.classList.add('group-slug-page-active')
    
    // クリーンアップ
    return () => {
      document.body.classList.remove('group-slug-page-active')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-8">
          {/* グループロゴ（透明度アニメーション） */}
          <div className="relative w-32 h-32">
            {group?.logoUrl ? (
              <Image
                src={group.logoUrl}
                alt={`${group.name} ロゴ`}
                fill
                className="object-contain animate-[fade_2s_infinite] opacity-50"
                priority
              />
            ) : (
              /* ロゴがない場合はプレースホルダー */
              <div className="w-full h-full bg-gray-700 rounded-full animate-[fade_2s_infinite] opacity-50 flex items-center justify-center">
              </div>
            )}
          </div>
          
          {/* Loadingインジケーター */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '200ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '400ms' }}></div>
            </div>
            <span className="text-white text-sm font-medium ml-3">Loading...</span>
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
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-4xl font-bold mb-4">GROUP NOT FOUND</h1>
          <p>お探しのグループは存在しません。</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        backgroundColor: group.backgroundColor || '#000',
        color: group.textColor || '#fff',
        backgroundImage: group.backgroundGradient || undefined,
      }}
    >
      {/* グループ専用ナビゲーション */}
      <GroupNavbar group={group} slug={slug} />
      
      {/* メインコンテンツ */}
      <main className="group-main-content">
        {children}
      </main>
    </div>
  )
}