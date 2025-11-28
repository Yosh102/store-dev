// app/api/log/wallet/verify-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from '@/lib/firebase-admin'

export const runtime = 'nodejs'          // admin SDK は Node 実行に限定
export const dynamic = 'force-dynamic'   // 事前ビルドで実行されないように
export const revalidate = 0
export const fetchCache = 'force-no-store'

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

/** Authorization: Bearer <ID_TOKEN> を安全に取り出す */
function parseBearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization') || ''
  if (!h.startsWith('Bearer ')) return null
  const token = h.slice(7).trim()
  if (!token || token === 'null' || token === 'undefined') return null
  return token
}

/** ざっくり /24 の前半3オクテットまで（IPv6は空に） */
function getIpPrefix(req: NextRequest) {
  const xf = req.headers.get('x-forwarded-for') || ''
  const ip = xf.split(',')[0]?.trim() || ''
  if (!ip) return ''
  return ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.*' : ''
}

type VerifyBody = {
  code?: string
  sessionId?: string
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth 検証（必ず ID トークンを期待）
    const idToken = parseBearer(req)
    if (!idToken) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }
    const decoded = await adminAuth.verifyIdToken(idToken)
    const userId = decoded.uid

    // 2) body
    const body = (await req.json().catch(() => ({}))) as VerifyBody
    const code = body.code?.toUpperCase()
    const sessionId = body.sessionId
    if (!code || !sessionId) {
      return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
    }

    // 3) 取得
    const ref = adminDb.collection('walletAccessCodes').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }
    const data = snap.data() as any
    if (!data) {
      return NextResponse.json({ ok: false, reason: 'no_data' }, { status: 404 })
    }

    // 4) 基本チェック
    if (data.scope !== 'wallet_access') {
      return NextResponse.json({ ok: false, reason: 'wrong_scope' }, { status: 400 })
    }

    const expireAt = data.expireAt?.toDate?.() ?? data.expireAt
    if (!expireAt || new Date(expireAt).getTime() <= Date.now()) {
      await ref.delete()
      return NextResponse.json({ ok: false, reason: 'expired' }, { status: 400 })
    }

    const attempts: number = Number(data.attempts ?? 0)
    const maxAttempts: number = Number(data.maxAttempts ?? 5)
    if (attempts >= maxAttempts) {
      await ref.delete()
      return NextResponse.json({ ok: false, reason: 'locked' }, { status: 400 })
    }

    // 5) 端末・セッションの緩やか一致
    const ua = (req.headers.get('user-agent') || '').slice(0, 256)
    const uaHash = sha256(ua)
    const ipPrefix = getIpPrefix(req)

    if (data.sessionId && data.sessionId !== sessionId) {
      return NextResponse.json({ ok: false, reason: 'session_mismatch' }, { status: 400 })
    }
    if (data.uaHash && data.uaHash !== uaHash) {
      await ref.update({ attempts: attempts + 1, updatedAt: Timestamp.now() })
      return NextResponse.json({ ok: false, reason: 'device_mismatch' }, { status: 400 })
    }
    if (data.ipPrefix && ipPrefix && data.ipPrefix !== ipPrefix) {
      await ref.update({ attempts: attempts + 1, updatedAt: Timestamp.now() })
      return NextResponse.json({ ok: false, reason: 'network_mismatch' }, { status: 400 })
    }

    // 6) ハッシュ照合
    const salt: string = String(data.salt || '')
    const pepper = process.env.WALLET_CODE_PEPPER || ''
    const inputHash = sha256(salt + code + pepper) // 大文字で統一済み
    if (inputHash !== data.codeHash) {
      await ref.update({ attempts: attempts + 1, updatedAt: Timestamp.now() })
      return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })
    }

    // 7) 成功 → ワンタイム削除 & 短期クッキーで許可（10分）
    await ref.delete()

    const res = NextResponse.json({ ok: true })
    res.cookies.set({
      name: 'wallet_access_granted',
      value: '1',
      path: '/',
      maxAge: 10 * 60, // 10分
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
    return res
  } catch (e) {
    console.error('verify-code error:', e)
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}
