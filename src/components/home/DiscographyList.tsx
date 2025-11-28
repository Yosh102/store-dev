"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Music, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveImageUrl } from '@/lib/staff-diary'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore'
import type { Group, DiscographyItem } from '@/types/group'

interface DiscographyWithGroup extends DiscographyItem {
  groupName: string
  groupSlug: string
}

interface AllDiscographyCarouselProps {
  className?: string
  limit?: number
}

const AllDiscographyCarousel: React.FC<AllDiscographyCarouselProps> = ({ 
  className = "", 
  limit = 10 
}) => {
  const [discographyItems, setDiscographyItems] = useState<DiscographyWithGroup[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 全グループを取得
  const getAllGroups = async (): Promise<Group[]> => {
    try {
      const groupsRef = collection(db, 'groups')
      const querySnapshot = await getDocs(groupsRef)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Group))
    } catch (error) {
    //   console.error('Error fetching groups:', error)
      return []
    }
  }

  // 全ディスコグラフィーを取得
  const getAllDiscography = async (): Promise<DiscographyItem[]> => {
    try {
      const discographyRef = collection(db, 'discography')
      const q = query(
        discographyRef,
        where('isActive', '==', true),
        orderBy('releaseDate', 'desc'),
        firestoreLimit(limit)
      )
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as DiscographyItem))
    } catch (error) {
    //   console.error('Error fetching discography:', error)
      return []
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // まずグループを取得
        // console.log('Fetching groups...')
        const groupsRef = collection(db, 'groups')
        const groupsSnapshot = await getDocs(groupsRef)
        
        const groupsData = groupsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Group))
        
        // console.log('Groups fetched:', groupsData.length)
        // console.log('Group details:', groupsData.map(g => ({ id: g.id, name: g.name })))
        
        // 次にディスコグラフィーを取得
        // console.log('Fetching discography...')
        const discographyRef = collection(db, 'discography')
        const q = query(
          discographyRef,
          where('isActive', '==', true),
          orderBy('releaseDate', 'desc'),
          firestoreLimit(limit)
        )
        const discographySnapshot = await getDocs(q)
        
        const discographyData = discographySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as DiscographyItem))
        
        // console.log('Discography fetched:', discographyData.length)
        // console.log('Discography details:', discographyData.map(d => ({ 
        //   title: d.title, 
        //   groupId: d.groupId 
        // })))
        
        setGroups(groupsData)
        
        // マッチング処理
        const discographyWithGroups: DiscographyWithGroup[] = discographyData.map(item => {
          const group = groupsData.find(g => g.id === item.groupId)
          
        //   console.log(`Matching ${item.title}:`)
        //   console.log(`  Looking for groupId: ${item.groupId}`)
        //   console.log(`  Found group:`, group ? `${group.name} (${group.id})` : 'None')
          
          return {
            ...item,
            groupName: group?.name || `不明なグループ (${item.groupId})`,
            groupSlug: group?.slug || ''
          }
        })
        
        // console.log('Final result:', discographyWithGroups.map(item => ({
        //   title: item.title,
        //   groupName: item.groupName
        // })))
        
        setDiscographyItems(discographyWithGroups)
        
      } catch (err) {
        // console.error('Error fetching data:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [limit])

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
      case 'single': return 'bg-pink-100 text-pink-600 border-pink-200'
      case 'album': return 'bg-green-100 text-green-600 border-green-200'
      case 'ep': return 'bg-purple-100 text-purple-600 border-purple-200'
      case 'compilation': return 'bg-blue-100 text-blue-600 border-blue-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  // スクロール機能
  const scrollContainer = (direction: 'left' | 'right') => {
    const container = document.getElementById('discography-scroll-container')
    if (container) {
      const scrollAmount = 176 // カードの幅(160px) + gap(16px)
      const newScrollLeft = direction === 'left' 
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount
      
      container.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      })
    }
  }

  // 外部リンクを開く関数
  const handleItemClick = (musicUrl: string) => {
    window.open(musicUrl, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="animate-pulse">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-40">
                <div className="w-40 h-40 bg-gray-200 rounded-lg mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <Music className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (discographyItems.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-8">
          <Music className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">ディスコグラフィーがありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="relative">
        {/* スクロールボタン */}
        <div className="absolute -left-4 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollContainer('left')}
            className="bg-white/90 hover:bg-white shadow-lg rounded-full h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="absolute -right-4 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={() => scrollContainer('right')}
            className="bg-white/90 hover:bg-white shadow-lg rounded-full h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* カルーセルコンテナ */}
        <div 
          id="discography-scroll-container"
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {discographyItems.map((item) => (
            <div 
              key={item.id} 
              onClick={() => handleItemClick(item.musicUrl)}
              className="flex-shrink-0 w-40 group cursor-pointer"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="transition-all duration-300 group-hover:scale-105">
                {/* アートワーク */}
                <div className="relative w-40 h-40 rounded-lg overflow-hidden mb-3 shadow-md">
                  <Image
                    src={resolveImageUrl(item.thumbnailUrl) || '/placeholder.jpg'}
                    alt={`${item.title}のアートワーク`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                  />

                  {/* 外部リンクアイコン */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-black/50 rounded-full p-1.5">
                      <ExternalLink className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  
                  {/* ホバー時のオーバーレイ */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />
                </div>

                {/* 情報部分 */}
                <div className="space-y-1">
                  <h3 className="text-center font-medium text-sm line-clamp-2 leading-relaxed group-hover:text-gray-700 transition-colors">
                    {item.title}
                  </h3>
                  
                  <div className="space-y-0.5">
                    <p className="text-center text-xs font-medium text-gray-600">
                      {item.groupName}
                    </p>
                    <p className="text-center text-xs text-gray-500">
                      {formatReleaseDate(item.releaseDate)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* カスタムスクロールバーを隠すCSS */}
      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default AllDiscographyCarousel