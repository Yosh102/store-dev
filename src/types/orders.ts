// src/types/orders.ts

export interface SelectedOption {
  optionId: string
  optionName: string
  valueId: string
  valueName: string
  priceModifier?: number
}

export interface OrderItem {
  id?: string
  name?: string
  price: number
  quantity: number
  images?: string[]
  selectedOptions?: SelectedOption[]
  requiresShipping?: boolean
  itemType?: 'product' | 'special_cheer'
  postId?: string
  postTitle?: string
  metadata?: {
    message?: string
    groupName?: string
    [key: string]: any
  }
  excludeTax?: boolean
  tags?: string[]
}

export interface PayPayNativeData {
  merchantPaymentId: string
  userAuthorizationId?: string
  paymentId?: string
  paymentStatus: 'CREATED' | 'COMPLETED' | 'FAILED' | 'CANCELED'
  createdAt: any
  completedAt?: any
  paymentDetails?: any
  lastChecked?: any
  lastApiError?: any
}

export interface Order {
  id: string
  userId: string
  items: OrderItem[]
  total: number
  subtotal: number
  subtotalExTax?: number
  tax?: number
  shippingFee: number
  status:
    | 'pending'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'canceled'
    | 'pending_paypay'
    | 'pending_paypay_native'
    | 'pending_bank_transfer'
    | 'paid'
  paymentStatus:
    | 'pending'
    | 'paid'
    | 'succeeded'
    | 'failed'
    | 'refunded'
    | 'requires_action'
    | 'requires_confirmation'
    | 'expired'
    | 'canceled'
    | string
  paymentType?: 'card' | 'paypay' | 'bank_transfer' | 'paidy'
  createdAt: any
  updatedAt: any
  
  // Special Cheer用の追加フィールド
  orderType?: 'product' | 'special_cheer' | 'membership'
  specialCheer?: {
    postId: string
    postTitle?: string
    groupId?: string
    groupName?: string
    authorId?: string
    authorName?: string
    message?: string
    displayName?: string
    isAnonymous?: boolean
    selectedAmount: number
  }
  
  shippingInfo?: {
    address?: string
    line1?: string
    line2?: string
    city: string
    postalCode: string
    name: string
    nameKana?: string
    prefecture?: string
    phoneNumber?: string
  }
  trackingNumber?: string
  paymentMethod?: {
    type: string
    last4?: string
    brand?: string
    firebase_uid?: string
  }
  hostedInstructionsUrl?: string
  payPayNative?: PayPayNativeData
  provider?: string
  metadata?: {
    firebase_uid?: string
    order_source?: string
    created_from?: string
    [key: string]: any
  }
  paidy_webhook_data?: {
    event_type?: string
    status?: string
    received_at?: any
  }
  source?: string
  payment?: {
    status?: string
  }
}