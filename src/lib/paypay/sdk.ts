// src/lib/paypay/sdk.ts
// ※ このファイルには runtime 指定は不要。呼び出す側(各 route.ts)で runtime='nodejs' を指定してください。

let _sdk: any | null = null

/** SDK を遅延ロード（CJS/ESM 両対応） */
async function loadSDK(): Promise<any> {
  if (_sdk) return _sdk

  // 1) ESM の dynamic import でトライ
  try {
    const m = await import('@paypayopa/paypayopa-sdk-node')
    _sdk = (m as any).default ?? m
  } catch {
    // 2) createRequire 経由で CJS トライ（ビルド環境差を吸収）
    const { createRequire } = await import('module' as any)
    const req = createRequire(import.meta.url)
    try {
      _sdk = req('@paypayopa/paypayopa-sdk-node')
    } catch {
      throw new Error(
        'Missing @paypayopa/paypayopa-sdk-node. Install it in dependencies of THIS app (not devDependencies).'
      )
    }
  }

  // 環境設定
  const productionMode = (process.env.PAYPAY_ENVIRONMENT || 'sandbox') === 'production'
  _sdk.Configure({
    merchantId: process.env.PAYPAY_MERCHANT_ID,
    apiKey: process.env.PAYPAY_API_KEY,
    apiSecret: process.env.PAYPAY_API_SECRET,
    productionMode,
  })

  return _sdk
}

/** ネストパス候補から関数を探して呼ぶ */
function findFn(root: any, paths: string[]) {
  for (const p of paths) {
    const fn = p.split('.').reduce((acc: any, k: string) => (acc ? acc[k] : undefined), root)
    if (typeof fn === 'function') return fn
  }
  throw new Error(`PayPay SDK API not found. Tried: ${paths.join(', ')}`)
}

/** Create a Code（Web Cashier） */
export async function createCode(payload: {
  merchantPaymentId: string
  amount: { amount: number; currency: 'JPY' }
  codeType: 'ORDER_QR'
  orderDescription?: string
  orderItems?: any[]
  storeInfo?: string
  storeId?: string
  terminalId?: string
  requestedAt: number
  redirectUrl?: string
  redirectType?: 'WEB_LINK' | 'APP_DEEP_LINK'
  userAgent?: string
  isAuthorization?: boolean
  authorizationExpiry?: number
  ipAddress?: string
}) {
  const Raw = await loadSDK()
  const fn = findFn(Raw, ['Code.createCode', 'QRCode.createQRCode', 'code.createCode'])
  return fn(payload)
}

/** Get payment details */
export async function getPaymentDetails(merchantPaymentId: string) {
  const Raw = await loadSDK()
  const fn = findFn(Raw, [
    'Code.getPaymentDetails',
    'Codes.getPaymentDetails',
    'Payment.getPaymentDetails',
    'Payments.getPaymentDetails',
  ])
  return fn(merchantPaymentId)
}

/** Cancel a payment */
export async function cancelPayment(merchantPaymentId: string) {
  const Raw = await loadSDK()
  const fn = findFn(Raw, ['Payment.cancelPayment', 'Payments.cancelPayment', 'Code.cancelPayment'])
  return fn(merchantPaymentId)
}
