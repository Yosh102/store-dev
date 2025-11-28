// app/group/[slug]/staff/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Lock, User, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { getGroupStaffDiaries, getGroupBySlug, resolveImageUrl } from '@/lib/staff-diary'
import type { StaffDiaryListItem } from '@/types/staff_diary'
import type { Group } from '@/types/group'
import JoinSection from "@/components/group/JoinSection"


export default function StaffDiaryPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [group, setGroup] = useState<Group | null>(null)
  const [diaries, setDiaries] = useState<StaffDiaryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // slugからグループ情報を直接取得
        const currentGroup = await getGroupBySlug(slug)
        
        if (!currentGroup) {
          setError('グループが見つかりません')
          return
        }
        
        setGroup(currentGroup)
        
        // STAFF DIARY一覧を取得
        const diariesData = await getGroupStaffDiaries(currentGroup.id, 50)
        setDiaries(diariesData)
        
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [slug])

  // サブスクリプション状態をチェック（表示用のみ）
  const { user } = useAuth()
  const isSubscribed = group?.id && user?.subscriptions?.[group.id] 
    ? user.subscriptions[group.id].status === "active" 
    : false

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="aspect-video bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <p className="text-red-500 text-center">{error || 'グループが見つかりません'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="container mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <Link 
            href={`/group/${slug}`} 
            className="inline-flex items-center text-black hover:text-gray-50 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            HOME
          </Link>
          <h1 className="text-4xl font-bold text-black">{group.name} STAFF DIARY</h1>
          
          {/* サブスクリプション状態の表示 */}
          {!user && (
            <div className="mt-4 p-4 bg-gray-200 rounded-lg">
              <p className="text-gray-800">
                <Lock className="h-4 w-4 inline mr-2" />
                記事の詳細を読むにはログインとメンバーシップが必要です。
                <Link href="/login" className="underline ml-2">ログイン</Link>
              </p>
            </div>
          )}
          
          {user && !isSubscribed && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800">
                <Lock className="h-4 w-4 inline mr-2" />
                記事の詳細を読むには{group.name}のメンバーシップが必要です。
                <Link href={`/group/${slug}#join-section`} className="underline ml-2">メンバーシップに加入</Link>
              </p>
            </div>
          )}
        </div>

        {/* 記事一覧 */}
        {diaries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {diaries.map((diary) => (
              <Link 
                key={diary.id} 
                href={`/group/${slug}/staff/${diary.id}`}
                className="overflow-hidden hover:shadow-lg group"
              >
                <div className="relative aspect-video">
                  {/* サムネイル画像 */}
                  <Image
                    src={resolveImageUrl(diary.thumbnailPublic)}
                    alt={diary.title}
                    fill
                    className={`object-cover rounded-lg group-hover:scale-105 transition-transform`}
                  />
                  
                  {/* ロックアイコン（非サブスクライバー用） */}
                  {(!user || !isSubscribed) && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-black/70 rounded-full p-3">
                        <Lock className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-6">
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <time>
                      {format(diary.publishDate.toDate(), "yyyy/MM/dd")}
                    </time>
                  </div>
                  <h3 className="font-bold text-lg text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {diary.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500 text-lg mt-16">まだSTAFF DIARYはありません。</p>
          </div>
        )}
      </div>
    </div>
  )
}