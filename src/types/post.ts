import type { Timestamp } from "firebase/firestore"

export interface Post {
  id: string
  title: string
  content: string
  thumbnailUrl?: string
  publishDate: Timestamp
  status: "draft" | "published"
  membersOnly: boolean
  categories: string[]
  tags: string[]
  groups: string[]
  isOfficialAnnouncement: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  authorName?: string // ✅ 追加（オプション）
  authorImage?: string // ✅ 追加（オプション）
  /** 追加フィールド */
  pickup_thumb?: string            // ピックアップ表示用の背景画像URL
  pickup_thumb_pc?: string            // ピックアップ表示用の背景画像URL
  excerpt?: string // ✅ 追加

  pickup_title_color?: string      // タイトル文字色（カラーコード指定）
  pickup_subtitle?: string         // 副題テキスト
  pickup_color?: string           // 背景色

}
