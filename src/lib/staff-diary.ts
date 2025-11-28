// lib/staff-diary.ts
import { 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit,
    Timestamp 
  } from 'firebase/firestore'
  import { db } from './firebase'
  import type { StaffDiary, StaffDiaryWithMembers, StaffDiaryListItem } from '@/types/staff_diary'
  import type { Group, GroupMember } from '@/types/group'
  
  // グループのSTAFF DIARY一覧を取得（認証不要）
  export async function getGroupStaffDiaries(
    groupId: string, 
    limitCount: number = 10
  ): Promise<StaffDiaryListItem[]> {
    try {
      const q = query(
        collection(db, 'staff_diary'),
        where('groupId', '==', groupId),
        where('isPublished', '==', true),
        orderBy('publishDate', 'desc'),
        limit(limitCount)
      )
      
      const querySnapshot = await getDocs(q)
      const diaries: StaffDiaryListItem[] = []
      
      for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data() as StaffDiary
        
        // 関連メンバーの詳細情報を取得
        let relatedMemberDetails: GroupMember[] = []
        if (data.relatedMembers && data.relatedMembers.length > 0) {
          try {
            const groupDoc = await getDoc(doc(db, 'groups', groupId))
            if (groupDoc.exists()) {
              const group = groupDoc.data() as Group
              relatedMemberDetails = group.members.filter(member => 
                data.relatedMembers?.includes(member.id)
              )
            }
          } catch (groupError) {
            console.warn('Could not fetch group details for related members:', groupError)
            // グループ詳細取得に失敗してもエラーにしない
          }
        }
        
        diaries.push({
          id: docSnap.id,
          title: data.title,
          thumbnailPublic: data.thumbnailPublic,
          thumbnailPrivate: data.thumbnailPrivate,
          publishDate: data.publishDate,
          authorName: data.authorName,
          relatedMembers: data.relatedMembers,
          relatedMemberDetails
        })
      }
      
      return diaries
    } catch (error) {
      console.error('Error fetching staff diaries:', error)
      // 認証エラーの場合は空配列を返す
      if (error instanceof Error && error.message.includes('permissions')) {
        console.warn('Insufficient permissions, returning empty array')
        return []
      }
      throw error
    }
  }
  
  // 特定のSTAFF DIARY記事を取得
  export async function getStaffDiary(diaryId: string): Promise<StaffDiaryWithMembers | null> {
    try {
      const docSnap = await getDoc(doc(db, 'staff_diary', diaryId))
      
      if (!docSnap.exists()) {
        return null
      }
      
      const data = docSnap.data() as StaffDiary
      
      // 関連メンバーの詳細情報を取得
      let relatedMemberDetails: GroupMember[] = []
      if (data.relatedMembers && data.relatedMembers.length > 0) {
        const groupDoc = await getDoc(doc(db, 'groups', data.groupId))
        if (groupDoc.exists()) {
          const group = groupDoc.data() as Group
          relatedMemberDetails = group.members.filter(member => 
            data.relatedMembers?.includes(member.id)
          )
        }
      }
      
      return {
        ...data,
        id: docSnap.id,
        relatedMemberDetails
      }
    } catch (error) {
      console.error('Error fetching staff diary:', error)
      throw error
    }
  }
  
  // グループ情報を取得
  export async function getGroup(groupId: string): Promise<Group | null> {
    try {
      const docSnap = await getDoc(doc(db, 'groups', groupId))
      
      if (!docSnap.exists()) {
        return null
      }
      
      return { id: docSnap.id, ...docSnap.data() } as Group
    } catch (error) {
      console.error('Error fetching group:', error)
      throw error
    }
  }
  
  // slugからグループを取得する関数を追加
  export async function getGroupBySlug(slug: string): Promise<Group | null> {
    try {
      const q = query(
        collection(db, 'groups'),
        where('slug', '==', slug),
        limit(1)
      )
      
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const doc = querySnapshot.docs[0]
      return { id: doc.id, ...doc.data() } as Group
    } catch (error) {
      console.error('Error fetching group by slug:', error)
      throw error
    }
  }
  export const resolveImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return "/placeholder.svg"
    if (imageUrl.includes('firebasestorage.googleapis.com')) return imageUrl
    if (imageUrl.startsWith('/')) return imageUrl
    return `/${imageUrl}`
  }