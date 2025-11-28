// src/types/digital-content.ts (拡張版)
import type { Timestamp } from "firebase/firestore"

// デジタルコンテンツのタイプ
export type DigitalContentType = "shared" | "custom"

// デジタルコンテンツのステータス
export type DigitalContentStatus = "pending" | "delivered"

// ファイル情報
export interface DigitalContentFile {
  id: string
  name: string
  storagePath: string
  size: number
  type: string
  uploadedAt?: Date | Timestamp
}

// デジタルコンテンツ（管理側）
export interface DigitalContent {
  id: string
  productId: string
  productName: string
  name: string
  description?: string
  files: DigitalContentFile[]
  type: DigitalContentType // ✅ 追加：shared or custom
  status: DigitalContentStatus
  
  // custom の場合のみ使用
  orderId?: string
  userId?: string
  userName?: string
  
  createdBy: string
  createdAt: string | Timestamp
  updatedAt?: string | Timestamp
  deliveredAt?: string | Timestamp
}

// ユーザーのデジタルグッズ
export interface UserDigitalGood {
  id: string
  contentId: string
  productId: string
  productName: string
  name: string
  description?: string
  thumbnail?: string
  files: Array<{
    id: string
    name: string
    size: number
    type: string
    url?: string
  }>
  type: DigitalContentType
  orderId?: string
  receivedAt: Date | Timestamp
  opened?: boolean
  openedAt?: Date | Timestamp
}

// 注文アイテムの拡張
export interface OrderItemWithDigitalContent {
  productId: string
  productName: string
  price: number
  quantity: number
  
  // ✅ デジタルコンテンツ情報
  digitalContentType?: DigitalContentType
  sharedContentId?: string // shared の場合
  customContentStatus?: "pending" | "processing" | "delivered" // custom の場合
}