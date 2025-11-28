// lib/error-codes.ts

/**
 * エラーコード定義
 * ユーザーにはエラーIDのみ表示し、この対応表で詳細を確認
 */

export const ERROR_CODES = {
  // Stripe Customer関連 (SUB-C-xxx)
  'SUB-C-001': {
    message: '顧客の作成に失敗しました',
    technicalDetail: 'Failed to create Stripe customer',
    solution: '',
  },
  'SUB-C-002': {
    message: '顧客の取得に失敗しました',
    technicalDetail: 'Failed to fetch Stripe customer',
    solution: 'ネットワーク接続を確認してください',
  },
  'SUB-C-003': {
    message: 'CSRFトークンが無効です',
    technicalDetail: 'Invalid CSRF token',
    solution: 'ページを再読み込みしてください',
  },
  'SUB-C-004': {
    message: 'ユーザー情報が不足しています',
    technicalDetail: 'User ID or email is missing',
    solution: 'ログインし直してください',
  },
  'SUB-S-005': {
    message: 'グループが見つかりません',
    technicalDetail: 'Group not found',
    solution: 'URLを確認してください',
  },
  'SUB-S-006': {
    message: '不正なプランが選択されています',
    technicalDetail: 'Price ID does not match group plan',
    solution: 'ページを再読み込みしてください',
  },
  'SUB-S-007': {
    message: '決済方法が他の顧客に紐付いています',
    technicalDetail: 'Payment method belongs to another customer',
    solution: '新しい決済方法を追加してください',
  },
  'SUB-S-008': {
    message: '短時間に多数のリクエストが送信されました',
    technicalDetail: 'Rate limit exceeded',
    solution: 'しばらく待ってから再度お試しください',
  },
  'SUB-S-009': {
    message: 'プランの価格情報が無効です',
    technicalDetail: 'Invalid or inactive price',
    solution: '管理者に問い合わせてください',
  },
  // Payment Methods関連 (SUB-P-xxx)
  'SUB-P-001': {
    message: '決済方法の取得に失敗しました',
    technicalDetail: 'Failed to fetch payment methods',
    solution: 'Stripe Customer IDを確認してください',
  },
  'SUB-P-002': {
    message: 'SetupIntentの作成に失敗しました',
    technicalDetail: 'Failed to create SetupIntent',
    solution: 'Stripe APIキーを確認してください',
  },
  'SUB-P-003': {
    message: 'カード情報の登録に失敗しました',
    technicalDetail: 'Failed to attach payment method',
    solution: 'カード情報を確認してください',
  },

  // Subscription関連 (SUB-S-xxx)
  'SUB-S-001': {
    message: 'サブスクリプションの作成に失敗しました',
    technicalDetail: 'Failed to create subscription',
    solution: 'Price IDとPayment Method IDを確認してください',
  },
  'SUB-S-002': {
    message: 'サブスクリプション情報の取得に失敗しました',
    technicalDetail: 'Failed to fetch subscription',
    solution: 'Subscription IDを確認してください',
  },
  'SUB-S-003': {
    message: '既にメンバーシップに登録されています',
    technicalDetail: 'Already subscribed',
    solution: '既存のサブスクリプションを確認してください',
  },
  'SUB-S-004': {
    message: '決済方法が選択されていません',
    technicalDetail: 'No payment method selected',
    solution: '決済方法を選択してください',
  },

  // 認証関連 (AUTH-xxx)
  'AUTH-001': {
    message: 'ログインが必要です',
    technicalDetail: 'User not authenticated',
    solution: 'ログインしてください',
  },
  'AUTH-002': {
    message: '認証トークンの取得に失敗しました',
    technicalDetail: 'Failed to get ID token',
    solution: 'ログインし直してください',
  },
  'AUTH-003': {
    message: '権限がありません',
    technicalDetail: 'Insufficient permissions',
    solution: '管理者に問い合わせてください',
  },

  // 一般エラー (GEN-xxx)
  'GEN-001': {
    message: '予期しないエラーが発生しました',
    technicalDetail: 'Unknown error',
    solution: 'ページを再読み込みして再度お試しください',
  },
  'GEN-002': {
    message: 'ネットワークエラーが発生しました',
    technicalDetail: 'Network error',
    solution: 'インターネット接続を確認してください',
  },
} as const

export type ErrorCode = keyof typeof ERROR_CODES

/**
 * エラーコードからエラー情報を取得
 */
export function getErrorInfo(code: ErrorCode) {
  return ERROR_CODES[code]
}

/**
 * エラーメッセージからエラーコードを推測
 */
export function detectErrorCode(error: any): ErrorCode {
  const errorMessage = error?.message?.toLowerCase() || ''
  
  // CSRF関連
  if (errorMessage.includes('csrf')) return 'SUB-C-003'
  
  // 認証関連
  if (errorMessage.includes('unauthorized') || errorMessage.includes('not authenticated')) {
    return 'AUTH-001'
  }
  if (errorMessage.includes('token')) return 'AUTH-002'
  if (errorMessage.includes('permission')) return 'AUTH-003'
  
  // Stripe Customer関連
  if (errorMessage.includes('customer') && errorMessage.includes('create')) {
    return 'SUB-C-001'
  }
  if (errorMessage.includes('customer') && errorMessage.includes('fetch')) {
    return 'SUB-C-002'
  }
  
  // Payment Methods関連
  if (errorMessage.includes('payment method')) {
    if (errorMessage.includes('fetch')) return 'SUB-P-001'
    if (errorMessage.includes('attach')) return 'SUB-P-003'
    return 'SUB-P-001'
  }
  if (errorMessage.includes('setup intent')) return 'SUB-P-002'
  
  // Subscription関連
  if (errorMessage.includes('subscription')) {
    if (errorMessage.includes('already')) return 'SUB-S-003'
    if (errorMessage.includes('create')) return 'SUB-S-001'
    if (errorMessage.includes('fetch')) return 'SUB-S-002'
    return 'SUB-S-001'
  }
  
  // ネットワークエラー
  if (errorMessage.includes('network') || errorMessage.includes('fetch failed')) {
    return 'GEN-002'
  }
  
  // デフォルト
  return 'GEN-001'
}

/**
 * エラーをログに記録（Firestoreなどに保存）
 */
export async function logError(
  errorCode: ErrorCode,
  context: {
    userId?: string
    action: string
    details?: any
  }
) {
  const errorInfo = getErrorInfo(errorCode)
  
  console.error('[ERROR]', {
    code: errorCode,
    message: errorInfo.message,
    technical: errorInfo.technicalDetail,
    context,
    timestamp: new Date().toISOString(),
  })
  
  // 本番環境では Firestore に保存
  if (process.env.NODE_ENV === 'production') {
    // TODO: Firestore への保存実装
    // await adminDb.collection('errorLogs').add({ ... })
  }
}