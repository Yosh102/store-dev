// src/app/api/paypay/native/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { paypayRequest } from '@/lib/paypay/http'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// PayPay Get payment details の型（最小限）
type GetPaymentDetailsRes = {
  resultInfo: { code: string; message: string; codeId?: string }
  data?: {
    paymentId?: string
    status: 'CREATED' | 'COMPLETED' | 'AUTHORIZED' | 'CANCELED' | 'EXPIRED' | 'FAILED'
    acceptedAt?: number
    expiresAt?: number
    canceledAt?: number
  }
}

export async function GET(req: NextRequest) {
  try {
    // ① クエリ (?orderId=...) を優先
    const url = new URL(req.url)
    const fromQuery = url.searchParams.get('orderId')

    // ② パス (/api/paypay/native/status/<id>) にも対応（将来拡張）
    const parts = url.pathname.split('/').filter(Boolean) // api paypay native status <id?>
    const fromPath = parts.length > 4 ? parts[4] : null

    const merchantPaymentId = fromQuery || fromPath
    if (!merchantPaymentId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    // PayPay へ照会（ここは“観測のみ”。DBは書き換えない）
    const payRes = await paypayRequest<GetPaymentDetailsRes>({
      method: 'GET',
      path: `/v2/codes/payments/${encodeURIComponent(merchantPaymentId)}`,
    })

    // エラーハンドリング（PayPayは200でも resultInfo がエラーのことがある）
    if (!payRes?.data?.status) {
      return NextResponse.json(
        { error: payRes?.resultInfo?.message || 'lookup failed', raw: payRes },
        { status: 502 }
      )
    }

    const st = payRes.data.status
    // 返却のみ（DB更新・メール送信はWebhook側に集約）
    return NextResponse.json({
      merchantPaymentId,
      status: st.toLowerCase(),   // created/completed/authorized/...
      paymentDetails: payRes.data // 受け取ったまま返す
    })
  } catch (e: any) {
    console.error('PayPay native/status error:', e?.message || e)
    return NextResponse.json({ error: '決済状況の確認中にエラーが発生しました' }, { status: 500 })
  }
}
