// app/api/log/wallet/send-code/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { sendWalletAccessCodeEmail } from '@/lib/mailer'

export const runtime = 'nodejs'          // admin SDK は必ず Node ランタイムで
export const dynamic = 'force-dynamic'   // 事前ビルドで実行させない
export const revalidate = 0
export const fetchCache = 'force-no-store'

// ---- ユーティリティ ----
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const genCode = (len = 6) =>
  Array.from(crypto.randomBytes(len))
    .map(b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36])
    .join('')

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
  // IPv4のみ簡易マスク
  return ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.*' : ''
}

type SendCodeBody = {
  sessionId?: string
  ua?: string
  ip?: string
}

export async function POST(req: NextRequest) {
  try {
    // 1) Firebase Auth 検証（Bearer <idToken>）
    const idToken = parseBearer(req)
    if (!idToken) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }

    const decoded = await adminAuth.verifyIdToken(idToken)
    const userId = decoded.uid

    // 2) body
    const body = (await req.json().catch(() => ({}))) as SendCodeBody
    const sessionId: string | undefined = body?.sessionId
    if (!sessionId) {
      return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 })
    }

    // 3) 端末情報（緩やかな結び付け）
    const ua = (req.headers.get('user-agent') || body.ua || '').slice(0, 256)
    const uaHash = sha256(ua)
    const ipPrefix = getIpPrefix(req)

    // 4) 連打ガード（直近60秒は再発行拒否）
    const docRef = adminDb.collection('walletAccessCodes').doc(userId)
    const existed = await docRef.get()
    if (existed.exists) {
      const d = existed.data() as any
      const last = d?.createdAt?.toDate?.() ?? d?.createdAt
      if (last && Date.now() - new Date(last as any).getTime() < 60 * 1000) {
        return NextResponse.json({ ok: false, reason: 'cooldown' }, { status: 429 })
      }
    }

    // 5) コード生成＆ハッシュ保存（生コードはメールのみ）
    const code = genCode(6) // A-Z0-9 / 6桁
    const salt = crypto.randomBytes(16).toString('hex')
    const pepper = process.env.WALLET_CODE_PEPPER || ''
    const codeHash = sha256(salt + code + pepper)
    const expireAt = new Date(Date.now() + 10 * 60 * 1000) // 10分

    await docRef.set({
      userId,
      scope: 'wallet_access',
      codeHash,
      salt,
      expireAt,
      attempts: 0,
      maxAttempts: 5,
      sessionId,
      uaHash,
      ipPrefix,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })

    // 6) 宛先メール（users コレクション or トークンの email）
    const userDoc = await adminDb.collection('users').doc(userId).get()
    const userData = (userDoc.data() || {}) as any
    const to: string | undefined = userData.email || decoded.email || undefined
    const userName: string =
      userData.displayName ||
      userData.name ||
      (decoded.email?.split('@')[0] ?? 'ユーザー')

    if (!to) {
      return NextResponse.json({ ok: false, reason: 'no_email' }, { status: 400 })
    }

    // 7) メール送信（本文は生コード / DBはハッシュのみ保持）
    await sendWalletAccessCodeEmail({
      to,
      userName,
      code,
      ttlMinutes: 10,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('send-code error:', e)
    // verifyIdToken 失敗などは 401 にしてもよいが、ログが十分なら 500 でも可
    return NextResponse.json({ ok: false, reason: 'server_error' }, { status: 500 })
  }
}
