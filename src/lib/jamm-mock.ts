// src/lib/jamm-mock.ts
// dev 専用の Jamm モッククライアント
// ⚠ 本番では絶対に使わない前提

export const jammMock = {
  payment: {
    async onSessionPayment(input: any) {
      const { buyer, charge, redirect } = input

      const now = new Date()
      const fakeChargeId = `trx_mock_${Date.now()}`
      const contractId = `con_mock_${Date.now()}`
      const customerId = `cus_mock_${Date.now()}`

      // フロントがそのまま遷移できるように successUrl を流用
      const successUrl: string =
        (redirect?.successUrl as string | undefined) ??
        'http://localhost:3000/order/jamm/success'

      const paymentUrl = `${successUrl}?mock=1&chargeId=${fakeChargeId}`

      const envelope = {
        contract: {
          id: contractId,
          status: 'CONTRACT_STATUS_INITIAL',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        charge: {
          id: fakeChargeId,
          price: charge?.price ?? 0,
          description: charge?.description ?? 'MOCK Jamm charge',
          metadata: charge?.metadata ?? {},
          expiresAt: charge?.expiresAt ?? null,
        },
        customer: {
          id: customerId,
          email: buyer?.email ?? 'mock@example.com',
          status: {
            payment: 'PAYMENT_AUTHORIZATION_STATUS_NOT_AUTHORIZED',
            kyc: 'KYC_STATUS_NOT_SUBMITTED',
          },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        paymentLink: {
          url: paymentUrl,
          createdAt: now.toISOString(),
          expiresAt: charge?.expiresAt ?? null,
        },
      }

      // 本物 SDK と同じ { success, data } 形に合わせる
      return {
        success: true,
        data: envelope,
      }
    },
  },
}