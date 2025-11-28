// /app/api/notify-order-confirmed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendOrderConfirmationEmail } from '@/lib/mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      to, userName, orderId, totalJPY, paymentType,
      address, items, shippingFeeJPY, paidAt, bankInstructionsUrl,
    } = body || {}

    if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 })
    if (!totalJPY || !paymentType) {
      return NextResponse.json({ error: 'totalJPY and paymentType are required' }, { status: 400 })
    }

    await sendOrderConfirmationEmail({
      to,
      userName,
      orderId,
      totalJPY,
      paymentType,
      address,
      items,
      shippingFeeJPY,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      bankInstructionsUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Internal Error', { status: 500 })
  }
}
