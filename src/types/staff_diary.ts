// types/staff-diary.ts
import { Timestamp } from 'firebase/firestore'
import { GroupMember } from './group'

export interface StaffDiary {
  id: string
  groupId: string
  authorId: string // 投稿者のUID
  authorName: string // 投稿者の名前
  title: string
  content: string // Markdown形式
  thumbnailPublic: string // 公開用サムネイル（ブラー + 鍵マーク）
  thumbnailPrivate: string // 閲覧用サムネイル（実際の画像）
  relatedMembers?: string[] // 関連するメンバーのID配列
  publishDate: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  isPublished: boolean
  viewCount?: number
}

export interface StaffDiaryWithMembers extends StaffDiary {
  relatedMemberDetails?: GroupMember[]
}

export interface StaffDiaryListItem {
  id: string
  title: string
  thumbnailPublic: string
  thumbnailPrivate: string
  publishDate: Timestamp
  authorName: string
  relatedMembers?: string[]
  relatedMemberDetails?: GroupMember[]
}