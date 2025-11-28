"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { X, ExternalLink, ArrowLeft, Music, Calendar, Tag } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { resolveImageUrl } from '@/lib/staff-diary'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import type { Group } from '@/types/group'
import type { DiscographyItem } from '@/types/group'
import GroupNavbar from '@/components/group/GroupNavbar'

// ディスコグラフィー詳細モーダル用の型
interface DiscographyDetailProps {
  item: DiscographyItem
  group: Group
  isOpen: boolean
  onClose: () => void
}

// ディスコグラフィー詳細モーダルコンポーネント
const DiscographyDetailModal: React.FC<DiscographyDetailProps> = ({ item, group, isOpen, onClose }) => {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatReleaseDate = (timestamp: any) => {
    if (!timestamp) return ''
    return timestamp.toDate().toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'album': return 'ALBUM'
      case 'single': return 'SINGLE'
      case 'ep': return 'EP'
      case 'compilation': return 'COMPILATION'
      default: return type.toUpperCase()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">{item.title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* コンテンツ */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* アートワーク */}
            <div className="flex-shrink-0">
              <div className="w-80 h-80 mx-auto md:mx-0 rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={resolveImageUrl(item.thumbnailUrl) || '/placeholder.jpg'}
                  alt={`${item.title}のアートワーク`}
                  width={320}
                  height={320}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* 購入・視聴リンク */}
              <div className="mt-4">
                <a
                  href={item.musicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors w-full justify-center"
                >
                  <span className="font-medium">聴く・購入する</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* 詳細情報 */}
            <div className="flex-1">
              <div className="space-y-6">
                {/* 基本情報 */}
                <div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`border px-3 py-1 text-sm font-medium`}>{getTypeLabel(item.type)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tracking-wider">RELEASE {formatReleaseDate(item.releaseDate)}</span>
                    </div>
                    {item.label && (
                      <div className="flex items-center gap-3">
                        <span className="font-medium">レーベル:</span>
                        <span>{item.label}</span>
                      </div>
                    )}
                    {item.producer && (
                      <div className="flex items-center gap-3">
                        <span className="font-medium">プロデューサー:</span>
                        <span>{item.producer}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 説明 */}
                {item.description && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">詳細</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>
                  </div>
                )}

                {/* トラックリスト */}
                {item.trackList && item.trackList.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">トラックリスト</h3>
                    <div className="space-y-2">
                      {item.trackList
                        .filter(track => track && track.title) // 有効なトラックのみフィルタリング
                        .map((track, index) => (
                        <div key={track.id || index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500 font-mono w-6">
                              {(track.trackNumber || index + 1).toString().padStart(2, '0')}
                            </span>
                            <span className="font-medium">{track.title}</span>
                          </div>
                          {track.duration && (
                            <span className="text-sm text-gray-500 font-mono">
                              {track.duration}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ディスコグラフィーカードコンポーネント
interface DiscographyCardProps {
  item: DiscographyItem
  onClick: () => void
}

const DiscographyCard: React.FC<DiscographyCardProps> = ({ item, onClick }) => {
  const formatReleaseDate = (timestamp: any) => {
    if (!timestamp) return ''
    return timestamp.toDate().toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '.')
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'album': return 'ALBUM'
      case 'single': return 'SINGLE'
      case 'ep': return 'EP'
      case 'compilation': return 'COMPILATION'
      default: return type.toUpperCase()
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'single': return 'border-pink-300 text-pink-400'
      case 'album': return 'border-green-300 text-green-400'
      case 'ep': return 'border-purple-300 text-purple-400'
      default: return 'border-gray-300 text-gray-400'
    }
  }

  return (
    <div 
      className="group cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="overflow-hidden hover:shadow-lg transition-shadow">
        {/* アートワーク */}
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={resolveImageUrl(item.thumbnailUrl) || '/placeholder.jpg'}
            alt={`${item.title}のアートワーク`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          
          {/* ホバー時のオーバーレイ */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
        </div>

        {/* 情報部分 */}
        <div className="p-4">
          {/* タイプバッジとリリース日 */}
          <div className="flex items-center gap-4 mb-3">
            <div className={`border px-3 py-1 text-sm font-medium ${getTypeColor(item.type)}`}>
              {getTypeLabel(item.type)}
            </div>
            <div className="text-sm font-medium text-black tracking-wide">
              RELEASE {formatReleaseDate(item.releaseDate)}
            </div>
          </div>
          
          {/* タイトル */}
          <h3 className="font-medium text-base text-black mb-1 line-clamp-2 leading-relaxed">
            {item.title}
          </h3>
        </div>
      </div>
    </div>
  )
}

export default function DiscographyPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [group, setGroup] = useState<Group | null>(null)
  const [discographyItems, setDiscographyItems] = useState<DiscographyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<DiscographyItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')

  // slugからグループを取得する関数
  const getGroupBySlug = async (slug: string): Promise<Group | null> => {
    try {
      const groupsRef = collection(db, 'groups')
      const q = query(groupsRef, where('slug', '==', slug))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const groupDoc = querySnapshot.docs[0]
      return {
        id: groupDoc.id,
        ...groupDoc.data()
      } as Group
    } catch (error) {
      console.error('Error fetching group by slug:', error)
      return null
    }
  }

  // グループIDに紐づくディスコグラフィーを取得する関数
  const getDiscographyItems = async (groupId: string): Promise<DiscographyItem[]> => {
    try {
      const discographyRef = collection(db, 'discography')
      const q = query(
        discographyRef, 
        where('groupId', '==', groupId),
        where('isActive', '==', true),
        orderBy('priority', 'asc'),
        orderBy('releaseDate', 'desc')
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DiscographyItem))
    } catch (error) {
      console.error('Error fetching discography items:', error)
      return []
    }
  }

  useEffect(() => {
    const fetchGroupAndDiscography = async () => {
      try {
        setLoading(true)
        
        // グループ情報を取得
        const groupData = await getGroupBySlug(slug)
        if (!groupData) {
          setError('グループが見つかりません')
          return
        }
        
        setGroup(groupData)
        
        // ディスコグラフィー情報を取得
        const discographyData = await getDiscographyItems(groupData.id)
        setDiscographyItems(discographyData)
        
      } catch (err) {
        console.error('Error fetching group and discography:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchGroupAndDiscography()
    }
  }, [slug])

  const handleItemClick = (item: DiscographyItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedItem(null)
  }

  const filteredItems = filterType === 'all' 
    ? discographyItems 
    : discographyItems.filter(item => item.type === filterType)

  const filterOptions = [
    { value: 'all', label: 'ALL', color: 'text-black border-black' },
    { value: 'single', label: 'SINGLE', color: 'text-black border-transparent' },
    { value: 'album', label: 'ALBUM', color: 'text-black border-transparent' },
    { value: 'ep', label: 'EP', color: 'text-black border-transparent' },
    { value: 'compilation', label: 'COMPILATION', color: 'text-black border-transparent' }
  ]

  if (loading) {
    return (
      <>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="aspect-square bg-gray-200"></div>
                    <div className="p-4">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error || !group) {
    return (
      <>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <p className="text-red-500 text-lg">{error || 'グループが見つかりません'}</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <title>DISCOGRAPHY | {group.name} オフィシャルサイト</title>
      <GroupNavbar group={group} slug={slug} />
      
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* ページタイトル */}
            <Link 
              href={`/group/${slug}`} 
              className="inline-flex items-center text-black hover:text-gray-500 mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              HOME
            </Link>
            <h1 className="text-4xl font-bold text-black mb-6">DISCOGRAPHY</h1>

            {/* フィルター */}
            <div className="mb-8">
              <div className="flex flex-wrap gap-8">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterType(option.value)}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                      filterType === option.value
                        ? option.color
                        : 'text-gray-400 border-transparent hover:text-gray-600'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ディスコグラフィーグリッド */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredItems.map((item) => (
                <DiscographyCard
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>

            {/* アイテムがない場合 */}
            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <Music className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {filterType === 'all' 
                    ? 'ディスコグラフィー情報がありません' 
                    : `${filterOptions.find(o => o.value === filterType)?.label}がありません`
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ディスコグラフィー詳細モーダル */}
      {selectedItem && (
        <DiscographyDetailModal
          item={selectedItem}
          group={group}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}