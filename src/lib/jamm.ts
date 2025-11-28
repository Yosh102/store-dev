// src/lib/jamm.ts
import jammSdk from '@jamm-pay/node-sdk'

declare global {
  // Next.js のホットリロード対策（サーバー側グローバル）
  // eslint-disable-next-line no-var
  var _jammInitializedForJammSdk: boolean | undefined
}

/**
 * ローカル開発時に完全モックを使うかどうか
 * .env.local:
 *   NEXT_PUBLIC_JAMM_USE_MOCK=true
 */
const useMock =
  process.env.NEXT_PUBLIC_JAMM_USE_MOCK === 'true' ||
  process.env.JAMM_USE_MOCK === 'true'

let jammClient: typeof jammSdk

if (useMock) {
  console.log('[jamm] ⚠️ using MOCK Jamm client (local only)')

  const mockPayment = {
    async onSessionPayment(input: any) {
      const now = new Date()
      const nowIso = now.toISOString()
      const tempOrderId =
        input?.charge?.metadata?.tempOrderId ?? `jamm_temp_${Date.now()}`
      const total = input?.charge?.price ?? 0

      const chargeId = `trx_mock_${Date.now()}`
      const contractId = `con_mock_${Date.now()}`
      const customerId = `cus_mock_${Date.now()}`

      const redirectBase =
        input?.redirect?.successUrl ||
        'http://localhost:3000/order/jamm/success'

      return {
        success: true,
        data: {
          contract: {
            id: contractId,
            status: 'CONTRACT_STATUS_INITIAL',
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          charge: {
            id: chargeId,
            price: total,
            description: input?.charge?.description ?? '',
            metadata: { tempOrderId },
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
          customer: {
            id: customerId,
            email: input?.buyer?.email ?? 'test@example.com',
            status: {
              payment: 'PAYMENT_AUTHORIZATION_STATUS_NOT_AUTHORIZED',
              kyc: 'KYC_STATUS_NOT_SUBMITTED',
            },
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          paymentLink: {
            url: `${redirectBase}?mock=1&chargeId=${chargeId}`,
            createdAt: nowIso,
            expiresAt: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        },
      }
    },
  }

  const mockWebhook = {
    // 署名検証はローカルではスキップ
    verify() {
      return true
    },
    // そのまま data を返すだけのダミー
    parse({ data }: { data: any }) {
      return data
    },
  }

  jammClient = {
    ...jammSdk,
    payment: mockPayment,
    webhook: mockWebhook,
  } as any
} else {
  // 本物 Jamm SDK を使うパス
  if (!global._jammInitializedForJammSdk) {
    const clientId =
      process.env.JAMM_CLIENT_ID ?? process.env.JAMM_MERCHANT_CLIENT_ID
    const clientSecret =
      process.env.JAMM_CLIENT_SECRET ?? process.env.JAMM_MERCHANT_CLIENT_SECRET

    const env =
      (process.env.JAMM_ENVIRONMENT as
        | 'local'
        | 'develop'
        | 'testing'
        | 'staging'
        | 'prod') || 'staging'

    if (!clientId || !clientSecret) {
      console.error('[jamm] ❌ clientId / clientSecret が設定されていません。', {
        JAMM_CLIENT_ID: process.env.JAMM_CLIENT_ID ? 'set' : 'missing',
        JAMM_MERCHANT_CLIENT_ID: process.env.JAMM_MERCHANT_CLIENT_ID
          ? 'set'
          : 'missing',
        JAMM_CLIENT_SECRET: process.env.JAMM_CLIENT_SECRET ? 'set' : 'missing',
        JAMM_MERCHANT_CLIENT_SECRET: process.env.JAMM_MERCHANT_CLIENT_SECRET
          ? 'set'
          : 'missing',
      })
    } else {
      jammSdk.config.init({
        clientId,
        clientSecret,
        environment: env,
      })
      console.log('[jamm] ✅ initialized with env =', env)
      global._jammInitializedForJammSdk = true
    }
  }

  jammClient = jammSdk
}

// ★ ここが今回のポイント：必ず `jamm` という名前で export する
export const jamm = jammClient
export const isJammMock = useMock
export default jammClient