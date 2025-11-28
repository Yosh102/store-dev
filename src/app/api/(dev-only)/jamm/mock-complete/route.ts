// src/app/api/(dev-only)jamm/mock-complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

/**
 * Jamm 決済の「完了」をローカルでモックするためのAPI
 *
 * POST /api/jamm/mock-complete
 * body: { chargeId: string, status: "success" | "fail" }
 *
 * ⚠ 本番では絶対に使わないこと！
 */
export async function POST(req: NextRequest) {
  // 本番で誤って叩かれないように保護
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development.' },
      { status: 403 },
    )
  }

  try {
    const body = await req.json().catch(() => null) as {
      chargeId?: string
      status?: 'success' | 'fail'
    } | null

    if (!body || !body.chargeId || !body.status) {
      return NextResponse.json(
        { error: 'chargeId and status ("success" | "fail") are required.' },
        { status: 400 },
      )
    }

    const { chargeId, status } = body

    const orderDocId = `jamm_${chargeId}`
    const orderRef = adminDb.collection('orders').doc(orderDocId)
    const snap = await orderRef.get()

    if (!snap.exists) {
      return NextResponse.json(
        { error: `order not found for chargeId=${chargeId}` },
        { status: 404 },
      )
    }

    const now = new Date()

    const paymentStatus = status === 'success' ? 'paid' : 'failed'
    const orderStatus = status === 'success' ? 'completed' : 'cancelled'

    await orderRef.set(
      {
        paymentStatus,
        status: orderStatus,
        jammMock: true,
        jammLastEvent: status,
        updatedAt: now,
      },
      { merge: true },
    )

    console.log('[jamm/mock-complete] updated order', {
      chargeId,
      paymentStatus,
      orderStatus,
    })

    return NextResponse.json({
      ok: true,
      chargeId,
      paymentStatus,
      orderStatus,
      orderId: orderDocId,
    })
  } catch (err: any) {
    console.error('[jamm/mock-complete] error:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unexpected error' },
      { status: 500 },
    )
  }
}