// app/api/paypay/webhook/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { sendOrderConfirmationEmail, sendSuperThanksConfirmationEmail } from '@/lib/mailer'

// ===== セキュリティ: PayPay公式IPアドレスのホワイトリスト =====

/**
 * PayPay公式Webhook送信元IPアドレス（本番環境）
 *
 * これらのIPアドレスからのリクエストのみ受け付けます
 * PayPayから提供された公式IPアドレス（2025年1月時点）
 */
const PAYPAY_OFFICIAL_IPS = [
  '52.68.128.84',
  '52.192.112.175',
  '13.115.29.37',
  '13.208.67.224',
  '13.208.235.224',
  '13.208.127.89',
]

/**
 * リクエストからクライアントIPを取得
 */
function getClientIP(req: NextRequest): string {
  // プロキシ経由の場合は X-Forwarded-For を優先
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    // カンマ区切りの場合は最初のIPを取得（最も信頼できる送信元）
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp

  // Cloudflare使用時
  const cfConnectingIp = req.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp

  // Vercel使用時
  const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim()
  }

  return 'unknown'
}

/**
 * PayPay公式IPかどうかを検証
 */
function isValidPayPayIP(clientIp: string): boolean {
  // 開発環境での動作確認用（本番では削除推奨）
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_IP_CHECK === 'true') {
    console.warn('⚠️ Development mode: Bypassing IP check')
    return true
  }

  // PayPay公式IPリストと照合
  const isAllowed = PAYPAY_OFFICIAL_IPS.includes(clientIp)

  if (!isAllowed) {
    console.error('Unauthorized IP address:', clientIp)
    console.error('Allowed IPs:', PAYPAY_OFFICIAL_IPS.join(', '))
  }

  return isAllowed
}

// ===== ユーティリティ =====

const nz = <T>(v: T | null | undefined) => (v == null ? undefined : v)

type PayPayTxnWebhook = {
  notification_type: 'Transaction'
  merchant_id?: string
  store_id?: string
  pos_id?: string
  order_id?: string
  merchant_order_id?: string
  authorized_at?: string | null
  expires_at?: string | null
  paid_at?: string | null
  order_amount?: string | number
  reauth_request_id?: string
  confirmation_expires_at?: string | null
  state:
    | 'AUTHORIZED'
    | 'COMPLETED'
    | 'CANCELED'
    | 'EXPIRED'
    | 'EXPIRED_USER_CONFIRMATION'
    | 'FAILED'
}

type PayPayFileWebhook = {
  notification_type: 'file.created'
  notification_id: string
  fileType: string
  path: string
  requestedAt: number
}

function mkEventId(payload: PayPayTxnWebhook) {
  const t = payload.paid_at || payload.authorized_at || payload.expires_at || ''
  return ['paypay', payload.order_id || 'unknown', payload.state, t].join(':')
}

function toTs(maybeIso?: string | null) {
  if (!maybeIso) return Timestamp.now()
  const ms = Date.parse(maybeIso)
  return Number.isFinite(ms) ? Timestamp.fromMillis(ms) : Timestamp.now()
}

function toAmount(v: string | number | undefined | null): number | undefined {
  if (v == null) return undefined
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : undefined
}

function isTxnPayload(body: any): body is PayPayTxnWebhook {
  return body && body.notification_type === 'Transaction' && typeof body.state === 'string'
}

function isFilePayload(body: any): body is PayPayFileWebhook {
  return body && body.notification_type === 'file.created'
}

async function markIfNew(eventId: string, raw: any) {
  const ref = adminDb.collection('paypayWebhookEvents').doc(eventId)
  const snap = await ref.get()
  if (snap.exists) return false
  await ref.set({
    id: eventId,
    provider: 'paypay',
    createdAt: Timestamp.now(),
    raw: nz(raw),
    handled: false,
  })
  return true
}

async function setHandled(eventId: string) {
  await adminDb.collection('paypayWebhookEvents').doc(eventId).set(
    { handled: true, handledAt: Timestamp.now() },
    { merge: true }
  )
}

async function sendPaidEmailOnce(orderId: string) {
  const ref = adminDb.collection('orders').doc(orderId)
  const snap = await ref.get()
  if (!snap.exists) return
  const order = snap.data() || {}

  if (order.paidEmailSent === true) return
  if (order.paymentType !== 'paypay') return

  const userId: string | undefined = order.userId
  if (!userId) return
  const userSnap = await adminDb.collection('users').doc(userId).get()
  if (!userSnap.exists) return
  const user = userSnap.data() || {}
  const to: string | undefined = user.email
  if (!to) return

  // ✅ Super Thanks かどうかをチェック
  const items = Array.isArray(order.items) ? order.items : []
  const superThanksItem = items.find((item: any) => item.itemType === 'special_cheer')

  if (superThanksItem && superThanksItem.postId) {
    // ✅ Super Thanks確認メールを送信
    await sendSuperThanksConfirmationEmail({
      to,
      userName: user.displayName || (to.split('@')[0] ?? 'ユーザー'),
      postId: superThanksItem.postId,
      postTitle: superThanksItem.postTitle || superThanksItem.name || '記事',
      groupName: superThanksItem.metadata?.groupName,
      amount: superThanksItem.price || 0,
      message: superThanksItem.metadata?.message,
      paidAt: order.paidAt?.toDate ? order.paidAt.toDate() : undefined,
      orderId,
    })

    console.log('✓ Super Thanks confirmation email sent (PayPay):', orderId)
  } else {
    // 通常の注文確認メール
    await sendOrderConfirmationEmail({
      to,
      userName: user.displayName || (to.split('@')[0] ?? 'ユーザー'),
      orderId,
      totalJPY: Number(order.total ?? 0) || 0,
      paymentType: 'paypay',
      address: order.shippingInfo
        ? {
            name: order.shippingInfo.name,
            prefecture: order.shippingInfo.prefecture,
            city: order.shippingInfo.city,
            line1: order.shippingInfo.line1,
          }
        : undefined,
      items: Array.isArray(order.items)
        ? order.items.map((it: any) => ({
            name: it.name ?? it.id ?? '商品',
            quantity: Number(it.quantity ?? 1),
            price: Number(it.price ?? 0),
          }))
        : [],
      shippingFeeJPY: Number(order.shippingFee ?? 0) || 0,
      paidAt: order.paidAt?.toDate ? order.paidAt.toDate() : undefined,
    })
  }

  await ref.set(
    { paidEmailSent: true, paidEmailSentAt: Timestamp.now(), updatedAt: Timestamp.now() },
    { merge: true }
  )

  await adminDb.collection('emailLogs').add({
    type: superThanksItem ? 'special_cheer_confirmation' : 'order_confirmation',
    orderId,
    userId,
    recipient: to,
    source: 'paypay_webhook',
    status: 'sent',
    sentAt: Timestamp.now(),
  })
}

// ===== Webhook 本体 =====

export async function POST(req: NextRequest) {
  try {
    // CRITICAL: IP制限による検証
    const clientIp = getClientIP(req)

    if (!isValidPayPayIP(clientIp)) {
      console.error('PayPay webhook blocked - Unauthorized IP:', clientIp)

      // 不正なリクエストを記録（監査・セキュリティ分析用）
      await adminDb
        .collection('webhookSecurityLogs')
        .add({
          type: 'paypay_ip_blocked',
          timestamp: Timestamp.now(),
          ip: clientIp,
          userAgent: req.headers.get('user-agent') || 'unknown',
          headers: {
            'x-forwarded-for': req.headers.get('x-forwarded-for'),
            'x-real-ip': req.headers.get('x-real-ip'),
            'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
          },
        })
        .catch((err) => console.error('Failed to log IP block:', err))

      // 401で返す（不正なリクエストとして拒否）
      return new NextResponse('Unauthorized', { status: 401 })
    }

    console.log('✓ PayPay webhook IP verified:', clientIp)

    // JSONとしてパース
    const body = await req.json().catch(() => null)
    if (!body) {
      console.error('Invalid JSON body')
      return NextResponse.json({ error: 'invalid json' }, { status: 400 })
    }

    // 基本検証: notification_typeの存在確認
    if (!body.notification_type) {
      console.error('Missing notification_type in webhook payload')
      return new NextResponse('OK', { status: 200 })
    }

    // 取引イベント以外（file.created など）はACKのみ
    if (isFilePayload(body)) {
      console.log('File webhook received:', body.fileType)
      return new NextResponse('OK', { status: 200 })
    }

    if (!isTxnPayload(body)) {
      console.log('ℹNon-transaction webhook received:', body.notification_type)
      return new NextResponse('OK', { status: 200 })
    }

    const payload = body as PayPayTxnWebhook

    // イベント冪等性チェック
    const eventId = mkEventId(payload)
    const isNew = await markIfNew(eventId, payload)
    if (!isNew) {
      console.log('⚠️ Duplicate webhook event:', eventId)
      return new NextResponse('OK', { status: 200 })
    }

    // merchant_order_idの検証
    const orderId = nz(payload.merchant_order_id) || ''
    if (!orderId) {
      console.error('Missing merchant_order_id in webhook payload')
      await setHandled(eventId)
      return new NextResponse('OK', { status: 200 })
    }

    // merchant_idの検証（環境変数と照合 - オプション）
    const expectedMerchantId = process.env.PAYPAY_MERCHANT_ID
    if (expectedMerchantId && payload.merchant_id !== expectedMerchantId) {
      console.error('Merchant ID mismatch:', {
        expected: expectedMerchantId,
        received: payload.merchant_id,
      })
      await setHandled(eventId)
      return new NextResponse('OK', { status: 200 })
    }

    console.log(`Processing webhook: ${payload.state} for order ${orderId}`)

    // 反映パッチを作成
    const patch: Record<string, any> = {
      updatedAt: Timestamp.now(),
      paypay: {
        orderId: nz(payload.order_id),
        state: payload.state,
        amount: toAmount(payload.order_amount),
        lastWebhookAt: Timestamp.now(),
      },
    }

    // ステータス変換
    switch (payload.state) {
      case 'AUTHORIZED': {
        patch.status = 'authorized'
        patch.paymentStatus = 'authorized'
        patch.authorizedAt = toTs(payload.authorized_at)
        if (payload.expires_at) patch.authExpiresAt = toTs(payload.expires_at)
        console.log('✓ Order authorized:', orderId)
        break
      }
      case 'COMPLETED': {
        patch.status = 'paid'
        patch.paymentStatus = 'succeeded'
        patch.paidAt = toTs(payload.paid_at)
        console.log('✓ Order completed:', orderId)
        break
      }
      case 'CANCELED': {
        patch.status = 'canceled'
        patch.paymentStatus = 'canceled'
        patch.canceledAt = Timestamp.now()
        console.log('✓ Order canceled:', orderId)
        break
      }
      case 'EXPIRED': {
        patch.status = 'expired'
        patch.paymentStatus = 'failed'
        patch.expiredAt = toTs(payload.expires_at)
        console.log('✓ Order expired:', orderId)
        break
      }
      case 'EXPIRED_USER_CONFIRMATION': {
        patch.status = 'expired'
        patch.paymentStatus = 'failed'
        patch.confirmationExpiredAt = toTs(payload.confirmation_expires_at)
        console.log('✓ User confirmation expired:', orderId)
        break
      }
      case 'FAILED': {
        patch.status = 'failed'
        patch.paymentStatus = 'failed'
        console.log('✓ Order failed:', orderId)
        break
      }
      default: {
        patch.status = 'pending'
        patch.paymentStatus = 'processing'
        console.log('Unknown state:', payload.state)
      }
    }

    // Firestore 反映
    const orderRef = adminDb.collection('orders').doc(orderId)
    await orderRef.set(patch, { merge: true })

    // ✅ COMPLETED時にSuper Thanks統計更新
    if (payload.state === 'COMPLETED') {
      const orderSnap = await orderRef.get()
      if (orderSnap.exists) {
        const orderData = orderSnap.data() || {}
        const items = orderData?.items || []
        const superThanksItem = items.find((item: any) => item.itemType === 'special_cheer')

        if (superThanksItem && superThanksItem.postId) {
          const postId = superThanksItem.postId
          const amount = superThanksItem.price || 0

          try {
            // 記事の統計を更新
            const postRef = adminDb.collection('posts').doc(postId)
            await postRef.set(
              {
                stats: {
                  superThanks: FieldValue.increment(amount),
                  superThanksCount: FieldValue.increment(1),
                },
                updatedAt: Timestamp.now(),
              },
              { merge: true }
            )

            console.log(`✓ Super Thanks processed (PayPay): ¥${amount} for post ${postId}`)

            // Super Thanks 履歴を記録
            await adminDb
              .collection('posts')
              .doc(postId)
              .collection('superThanks')
              .add({
                userId: orderData.userId,
                amount,
                message: superThanksItem.metadata?.message || null,
                orderId,
                paymentStatus: 'succeeded',
                createdAt: Timestamp.now(),
              })

            // クリエイターに通知を送信
            const postSnap = await postRef.get()
            if (postSnap.exists) {
              const postData = postSnap.data()
              const creatorId = postData?.userId || postData?.createdBy

              if (creatorId && creatorId !== orderData.userId) {
                const senderRef = adminDb.collection('users').doc(orderData.userId)
                const senderSnap = await senderRef.get()
                const senderName = senderSnap.exists
                  ? senderSnap.data()?.displayName || senderSnap.data()?.name || '匿名'
                  : '匿名'

                await adminDb.collection('notifications').add({
                  userId: creatorId,
                  type: 'special_cheer',
                  title: 'Special Cheerを受け取りました',
                  message: `${senderName}さんから¥${amount.toLocaleString()}のSpecial Cheerが送られました`,
                  link: `/posts/${postId}`,
                  data: {
                    postId,
                    senderId: orderData.userId,
                    amount,
                    postTitle: postData?.title,
                    message: superThanksItem.metadata?.message,
                  },
                  read: false,
                  createdAt: Timestamp.now(),
                })

                console.log(`✓ Super Thanks notification sent to ${creatorId} (PayPay)`)
              }
            }
          } catch (error) {
            console.error('Failed to update Super Thanks stats (PayPay):', error)
          }
        }
      }

      // メールは COMPLETED の時だけ冪等送信
      try {
        await sendPaidEmailOnce(orderId)
        console.log('✓ Confirmation email sent for order:', orderId)
      } catch (e) {
        console.error('Failed to send confirmation email:', e)
        await adminDb.collection('emailLogs').add({
          type: 'order_confirmation',
          orderId,
          status: 'failed',
          source: 'paypay_webhook',
          error: e instanceof Error ? e.message : String(e),
          sentAt: Timestamp.now(),
        })
      }
    }

    await setHandled(eventId)
    console.log('Webhook processed successfully:', eventId)

    return new NextResponse('OK', { status: 200 })
  } catch (e) {
    console.error('PayPay webhook error:', e)
    // エラーでも200で返す（再送ループ防止）
    return new NextResponse('OK', { status: 200 })
  }
}