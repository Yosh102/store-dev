// /app/api/notify-login/route.ts
import { NextRequest } from 'next/server'
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { sendLoginAlertEmail } from '@/lib/mailer'

export const runtime = 'nodejs'          // ★ Edgeでadminを使わない
export const dynamic = 'force-dynamic'   // ★ 事前ビルドで触らせない
export const revalidate = 0
export const fetchCache = 'force-no-store'

// 環境変数を丁寧に収集
const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCP_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY

// 改行・引用符の崩れを補正
const privateKey = rawPrivateKey
  ? rawPrivateKey
      .replace(/\\n/g, '\n')
      .replace(/^"|"$/g, '') // 環境により両端に " が付いてくることがある
  : undefined

// 初期化（一度だけ）
if (!getApps().length) {
  if (projectId && clientEmail && privateKey) {
    // サービスアカウントを明示指定
    initializeApp({
      credential: cert({
        projectId,           // ← ここが undefined だと今回のエラーになる
        clientEmail,
        privateKey,
      }),
      projectId,
    })
  } else {
    // フォールバック：GCPのADC / GOOGLE_APPLICATION_CREDENTIALS を利用
    initializeApp({
      credential: applicationDefault(),
      projectId: projectId, // あれば付ける（なくても動く環境あり）
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || ''
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null
    if (!idToken) return new Response('Unauthorized', { status: 401 })

    const decoded = await getAuth().verifyIdToken(idToken)
    const email = decoded.email
    if (!email) return new Response('No email', { status: 400 })

    const body = await req.json().catch(() => ({}))
    const eventType: 'login' | 'signup' = body.eventType ?? 'login'

    const ua = req.headers.get('user-agent') ?? body.ua
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      (req as any).ip ||
      body.ip

    await sendLoginAlertEmail({
      to: email,
      userName: decoded.name ?? undefined,
      loginAt: new Date(),
      ip,
      ua,
      eventType,
    })

    return Response.json({ ok: true })
  } catch (e) {
    console.error('notify-login error', e)
    return new Response('Internal Error', { status: 500 })
  }
}
