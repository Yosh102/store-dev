// src/app/api/jamm/webhook/route.ts
export const runtime = 'nodejs'

import { NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { jamm } from '@/lib/jamm'

export async function POST(req: NextRequest) {
  console.log('[jamm webhook] hit')

  const rawBody = await req.text()

  let message: any
  try {
    message = JSON.parse(rawBody)
  } catch (e) {
    console.error('[jamm webhook] JSON parse error', e)
    return new Response('invalid json', { status: 400 })
  }

  try {
    // --- ① 署名検証（本番のみ）---
    if (process.env.NODE_ENV === 'production') {
      jamm.webhook.verify({
        data: message,
        signature: message.signature,
      })
    }

    // --- ② parse（署名は本番のみ）---
    const got =
      process.env.NODE_ENV === 'production'
        ? jamm.webhook.parse({
            data: message,
            signature: message.signature,
          })
        : jamm.webhook.parse({
            data: message,
          })

    console.log('[jamm webhook] parsed:', got)

    // --- ③ イベントタイプ確認（event_type）---
    if (got.event_type === 'EVENT_TYPE_CHARGE_SUCCESS') {
      const charge = got.content
      const jammChargeId = charge.id
      const orderDocId = `jamm_${jammChargeId}`

      await adminDb.collection('orders').doc(orderDocId).set(
        {
          paymentStatus: 'paid',
          status: 'completed',
          updatedAt: new Date(),
          source: 'jamm-webhook',
        },
        { merge: true },
      )

      console.log('[jamm webhook] order marked as paid:', orderDocId)
    }

    return new Response('ok')
  } catch (e) {
    console.error('[jamm webhook] error', e)
    return new Response('error', { status: 500 })
  }
}