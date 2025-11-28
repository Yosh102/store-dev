// src/app/api/paypay/[merchantPaymentId]/route.ts
import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ★ 第2引数の注釈を外す（構文は維持）
export async function GET(req: NextRequest, { params }: any) {
  const id = (params as { merchantPaymentId: string }).merchantPaymentId

  const url = new URL(req.url)
  url.pathname = `/api/paypay/payments/${encodeURIComponent(id)}`

  const res = await fetch(url.toString(), { headers: Object.fromEntries(req.headers) })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function DELETE(req: NextRequest, { params }: any) {
  const id = (params as { merchantPaymentId: string }).merchantPaymentId

  const url = new URL(req.url)
  url.pathname = `/api/paypay/payments/${encodeURIComponent(id)}`

  const res = await fetch(url.toString(), { method: 'DELETE', headers: Object.fromEntries(req.headers) })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
