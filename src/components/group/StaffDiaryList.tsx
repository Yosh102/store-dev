// components/StaffDiaryList.tsx
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { Lock, User } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { getGroupStaffDiaries, resolveImageUrl } from '@/lib/staff-diary'
import type { StaffDiaryListItem } from '@/types/staff_diary'

interface StaffDiaryListProps {
  groupSlug: string
  groupId: string
  limit?: number
}

const StaffDiaryList: React.FC<StaffDiaryListProps> = ({ 
  groupSlug, 
  groupId, 
  limit = 6 
}) => {
  const [diaries, setDiaries] = useState<StaffDiaryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  // サブスクリプション状態をチェック（表示用のみ）
  const isSubscribed = user?.subscriptions?.[groupId]?.status === "active"

  useEffect(() => {
    const fetchDiaries = async () => {
      try {
        setLoading(true)
        const data = await getGroupStaffDiaries(groupId, limit)
        setDiaries(data)
      } catch (err) {
        console.error('Error fetching staff diaries:', err)
        setError('STAFF DIARYの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchDiaries()
  }, [groupId, limit])

  if (loading) {
    return (
      <div className="bg-white">
        <div className="container mx-auto px-4 py-16">
          <div className="mb-16">
            <h3 className="text-3xl font-bold mb-8">STAFF DIARY</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="relative aspect-video bg-gray-200 rounded-lg mb-4"></div>
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

  if (error) {
    return (
      <div className="bg-white">
        <div className="container mx-auto px-4 py-16">
          <div className="mb-16">
            <h3 className="text-3xl font-bold mb-8">STAFF DIARY</h3>
            <p className="text-red-500 text-center py-12">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white">
      <div className="container mx-auto px-4 py-16">
        <div className="mb-16">
          <div className="flex justify-between items-end mb-8">
            <h3 className="text-3xl font-bold">STAFF DIARY</h3>
            {diaries.length > 0 && (
              <Link 
                href={`/group/${groupSlug}/staff`} 
                className="text-gray-600 hover:text-gray-900 underline"
              >
                すべて見る
              </Link>
            )}
          </div>
          
          {diaries.length > 0 ? (
            <>
              {/* デスクトップ用 - グリッドレイアウト */}
              <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
                {diaries.map((diary) => (
                  <Link 
                    key={diary.id} 
                    href={`/group/${groupSlug}/staff/${diary.id}`} 
                    className="group block"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden mb-4">
                      <Image
                        src={resolveImageUrl(diary.thumbnailPublic)}
                        alt={diary.title}
                        fill
                        className={`object-cover transition-transform group-hover:scale-105 ${
                          !user || !isSubscribed ? 'filter blur-sm' : ''
                        }`}
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
                    
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <User className="h-4 w-4 mr-1" />
                      <span>{diary.authorName}</span>
                      <span className="mx-2">•</span>
                      <time>
                        {format(diary.publishDate.toDate(), "yyyy.MM.dd")}
                      </time>
                    </div>
                    
                    <h4 className="font-medium text-lg group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
                      {diary.title}
                    </h4>
                    
                    {diary.relatedMemberDetails && diary.relatedMemberDetails.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {diary.relatedMemberDetails.map((member) => (
                          <span 
                            key={member.id} 
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {member.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              {/* モバイル用 - 横スクロール */}
              <div className="md:hidden overflow-x-auto scrollbar-hide">
                <div className="flex gap-6 pb-4" style={{ width: 'max-content' }}>
                  {diaries.map((diary) => (
                    <Link 
                      key={diary.id} 
                      href={`/group/${groupSlug}/staff/${diary.id}`} 
                      className="group block flex-shrink-0"
                    >
                      <div className="relative w-80 aspect-video rounded-lg overflow-hidden mb-4">
                        <Image
                          src={resolveImageUrl(diary.thumbnailPublic)}
                          alt={diary.title}
                          fill
                          className={`object-cover transition-transform group-hover:scale-105 ${
                            !user || !isSubscribed ? 'filter blur-sm' : ''
                          }`}
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
                      
                      <div className="flex items-center text-sm text-gray-500 mb-2 w-80">
                        <User className="h-4 w-4 mr-1" />
                        <span>{diary.authorName}</span>
                        <span className="mx-2">•</span>
                        <time>
                          {format(diary.publishDate.toDate(), "yyyy.MM.dd")}
                        </time>
                      </div>
                      
                      <h4 className="font-medium text-lg group-hover:text-blue-600 transition-colors mb-2 w-80 line-clamp-2">
                        {diary.title}
                      </h4>
                      
                      {diary.relatedMemberDetails && diary.relatedMemberDetails.length > 0 && (
                        <div className="flex flex-wrap gap-1 w-80">
                          {diary.relatedMemberDetails.map((member) => (
                            <span 
                              key={member.id} 
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                            >
                              {member.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-12">STAFF DIARYはありません。</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default StaffDiaryList