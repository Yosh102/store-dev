import type { User } from "./user"
import { Timestamp } from "firebase/firestore"

export interface GroupMember {
  id: string
  name: string
  profileImage?: string
  biography?: string
}

export interface MemberWithProfile extends GroupMember {
  profile?: User
}

export interface LiveContent {
  title: string
  thumbnailUrl: string
}

export interface MediaContent {
  title: string
  imageUrl: string
}

export interface Group {
  id: string
  slug: string
  name: string
  description: string
  introduction: string
  coverImage: string
  logoUrl: string
  members: GroupMember[]
  subscriptionPlans: {
    monthly: {
      priceId: string
      amount: number
    }
    yearly: {
      priceId: string
      amount: number
    }
  }
  backgroundColor: string
  textColor: string
  accentColor: string
  backgroundGradient?: string
  customCSS?: string
  liveContent?: LiveContent[]
  mediaContent?: MediaContent[]
}

export interface GroupBanner {
  id: string
  groupId: string
  title: string
  imageUrl: string
  linkUrl?: string
  startDate: Timestamp
  endDate: Timestamp
  isActive: boolean
  priority: number // 表示順序（数字が小さいほど優先）
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GroupBannerWithGroup extends GroupBanner {
  groupName?: string
  groupSlug?: string
}

export interface HomeMovie {
  id: string
  groupId: string
  youtubeUrl: string
  startDate: Timestamp
  endDate: Timestamp
  priority: number // 表示順序（数字が小さいほど優先）
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// YouTube URLからVideo IDを抽出する関数用の型
export interface YouTubeVideoInfo {
  videoId: string
  thumbnailUrl: string
  embedUrl: string
}

export interface DiscographyItem {
  id: string
  groupId: string
  title: string
  type: 'album' | 'single' | 'ep' | 'compilation'
  releaseDate: Timestamp
  thumbnailUrl: string
  musicUrl: string // TuneCore等のURL (例: https://linkco.re/1ZaFhGBU)
  description?: string
  trackList?: Track[]
  label?: string
  producer?: string
  isActive: boolean
  priority: number // 表示順序（数字が小さいほど優先）
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Track {
  id: string
  title: string
  duration?: string // 例: "3:45"
  trackNumber: number
  lyrics?: string
  composer?: string
  lyricist?: string
}

export interface DiscographyItemWithGroup extends DiscographyItem {
  groupName?: string
  groupSlug?: string
}