// /app/api/notify-password-changed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendPasswordChangeEmail } from '@/lib/mailer'

function ipFromHeaders(req: NextRequest) {
  // 逆プロキシ越しも考慮
  const h = req.headers
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    undefined
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { to, userName, ua, changedAt } = body || {}

    if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 })

    await sendPasswordChangeEmail({
      to,
      userName,
      ua,
      changedAt: changedAt ? new Date(changedAt) : new Date(),
      ip: body.ip || ipFromHeaders(req),
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return new NextResponse(e?.message || 'Internal Error', { status: 500 })
  }
}
