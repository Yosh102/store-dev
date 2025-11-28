"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { X, Instagram, Twitter, Youtube, Music, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getGroup, resolveImageUrl } from '@/lib/staff-diary'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import type { Group, GroupMember } from '@/types/group'
import type { User } from '@/types/user'
import GroupNavbar from '@/components/group/GroupNavbar'

// メンバー詳細モーダル用の型
interface MemberDetailProps {
  member: GroupMember & { userProfile?: User }
  group: Group
  isOpen: boolean
  onClose: () => void
}

// メンバー詳細モーダルコンポーネント
const MemberDetailModal: React.FC<MemberDetailProps> = ({ member, group, isOpen, onClose }) => {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">{member.name}</h2>
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
            {/* プロフィール画像 */}
            <div className="flex-shrink-0">
              <div className="w-64 h-64 mx-auto md:mx-0 rounded-lg overflow-hidden">
                <Image
                  src={resolveImageUrl(member.userProfile?.avatarUrl || member.profileImage) || '/placeholder.jpg'}
                  alt={`${member.name}の詳細プロフィール画像`}
                  width={256}
                  height={256}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* プロフィール情報 */}
            <div className="flex-1">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">プロフィール</h3>
                  <div className="text-gray-700 leading-relaxed space-y-2">
                    {member.userProfile?.introduction ? (
                      <p className="whitespace-pre-wrap">{member.userProfile.introduction}</p>
                    ) : member.biography ? (
                      <p className="whitespace-pre-wrap">{member.biography}</p>
                    ) : (
                      <p className="text-gray-500">プロフィール情報がありません</p>
                    )}
                    
                    {/* 誕生日表示 */}
                    {member.userProfile?.birthday && (
                      <div className="pt-2">
                        <span className="font-medium">誕生日: </span>
                        <span>{member.userProfile.birthday.toDate().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* SNSリンク */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">SNS</h3>
                  <div className="flex gap-3 flex-wrap">
                    {member.userProfile?.xUsername && (
                      <a
                        href={`https://twitter.com/${member.userProfile.xUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Twitter className="h-4 w-4" />
                        <span className="text-sm">@{member.userProfile.xUsername}</span>
                      </a>
                    )}
                    
                    {member.userProfile?.youtubeChannel && (
                      <a
                        href={member.userProfile.youtubeChannel}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Youtube className="h-4 w-4" />
                        <span className="text-sm">YouTube</span>
                      </a>
                    )}
                    
                    {member.userProfile?.tiktokUsername && (
                      <a
                        href={`https://tiktok.com/@${member.userProfile.tiktokUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Music className="h-4 w-4" />
                        <span className="text-sm">@{member.userProfile.tiktokUsername}</span>
                      </a>
                    )}
                    
                    {!member.userProfile?.xUsername && !member.userProfile?.youtubeChannel && !member.userProfile?.tiktokUsername && (
                      <p className="text-gray-500 text-sm">SNS情報がありません</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// メンバーカードコンポーネント
interface MemberCardProps {
  member: GroupMember & { userProfile?: User }
  onClick: () => void
}

const MemberCard: React.FC<MemberCardProps> = ({ member, onClick }) => {
  return (
    <div 
      className="group cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="overflow-hidden">
        {/* メンバー画像 */}
        <div className="aspect-square relative overflow-hidden">
          <Image
            src={resolveImageUrl(member.userProfile?.avatarUrl || member.profileImage) || '/placeholder.jpg'}
            alt={`${member.name}のプロフィール画像`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110 rounded-lg"
          />
          
          {/* ホバー時のオーバーレイ */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-sm font-medium text-gray-900">詳細を見る</span>
              </div>
            </div>
          </div>
        </div>

        {/* メンバー名とSNSアイコン */}
        <div className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-900 mb-1">{member.name}</h3>
              
    
                {/* SNSアイコン */}
                <div className="flex gap-2">
                {member.userProfile?.xUsername && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Twitter className="h-4 w-4 text-gray-600" />
                    </div>
                )}
                {member.userProfile?.youtubeChannel && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Youtube className="h-4 w-4 text-gray-600" />
                    </div>
                )}
                {member.userProfile?.tiktokUsername && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <Music className="h-4 w-4 text-gray-600" />
                    </div>
                )}
                {!member.userProfile?.xUsername && !member.userProfile?.youtubeChannel && !member.userProfile?.tiktokUsername && (
                    <>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Twitter className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Instagram className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <Music className="h-4 w-4 text-gray-400" />
                    </div>
                    </>
                )}
                </div>
            </div>



            </div>
        </div>
      </div>
    </div>
  )
}

export default function GroupProfilePage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [group, setGroup] = useState<Group | null>(null)
  const [membersWithProfiles, setMembersWithProfiles] = useState<(GroupMember & { userProfile?: User })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<(GroupMember & { userProfile?: User }) | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  // グループIDに紐づくユーザー（メンバー）を取得する関数
  const getGroupMembers = async (groupId: string): Promise<User[]> => {
    try {
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('groupIds', 'array-contains', groupId))
      const querySnapshot = await getDocs(q)
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as User))
    } catch (error) {
      console.error('Error fetching group members:', error)
      return []
    }
  }

  useEffect(() => {
    const fetchGroupAndMembers = async () => {
      try {
        setLoading(true)
        
        // グループ情報を取得
        const groupData = await getGroupBySlug(slug)
        if (!groupData) {
          setError('グループが見つかりません')
          return
        }
        
        setGroup(groupData)
        
        // グループに紐づくユーザー（メンバー）を取得
        const memberUsers = await getGroupMembers(groupData.id)
        
        console.log('Group members from DB:', groupData.members)
        console.log('User members from groupIds:', memberUsers)
        
        // 実際のユーザーデータのみを使用（groupのmembersフィールドは使わない）
        const finalMembers: (GroupMember & { userProfile?: User })[] = memberUsers
          .filter(user => user && typeof user === 'object' && user.id) // 有効なユーザーオブジェクトのみ
          .map(user => ({
            id: user.id,
            name: user.displayName || 'Unknown',
            profileImage: user.avatarUrl,
            biography: user.introduction,
            userProfile: user
          }))

        console.log('Final members list:', finalMembers)
        setMembersWithProfiles(finalMembers)
        
      } catch (err) {
        console.error('Error fetching group and members:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchGroupAndMembers()
    }
  }, [slug])

  const handleMemberClick = (member: GroupMember & { userProfile?: User }) => {
    setSelectedMember(member)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedMember(null)
  }

  if (loading) {
    return (
      <>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[...Array(6)].map((_, i) => (
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
      <title>PROFILE | {group.name} オフィシャルサイト</title>
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
            <h1 className="text-4xl font-bold text-black">PROFILE</h1>
          

            {/* メンバーグリッド */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {membersWithProfiles.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  onClick={() => handleMemberClick(member)}
                />
              ))}
            </div>

            {/* メンバーが少ない場合の調整 */}
            {membersWithProfiles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">メンバー情報がありません</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メンバー詳細モーダル */}
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          group={group}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}