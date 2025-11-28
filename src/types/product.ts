//src/types/product.ts
import type { Timestamp } from "@/lib/firebase"

export interface ProductOption {
  id: string
  name: string // e.g., "サイズ", "カラー"
  type: "select" | "radio" | "checkbox"
  required: boolean
  values: ProductOptionValue[]
}

export interface ProductOptionValue {
  id: string
  name: string // e.g., "XL", "レッド"
  priceModifier?: number // 追加料金（オプション）
  stock?: number // オプション別在庫（オプション）
}

export interface Product {
  id: string
  name: string
  price: number
  description: string
  notice?: string
  images: string[]
  category: string
  tags: string[]
  stock: number
  publishStartDate: Timestamp
  publishEndDate: Timestamp | null
  requiresShipping: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  status: "draft" | "published" | "archived"
  maxQuantity?: number
  label?: string
  subtitle?: string
  shopCash?: number
  groups: string[]
  isMembersOnly: boolean
  options?: ProductOption[] // 新しく追加
}

// カート用の型も更新
export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  images: string[]
  requiresShipping: boolean
  selectedOptions?: SelectedOption[] // 選択されたオプション
}

export interface SelectedOption {
  optionId: string
  optionName: string
  valueId: string
  valueName: string
  priceModifier?: number
}