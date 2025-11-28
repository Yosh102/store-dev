// app/api/stripe/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import {
  sendOrderConfirmationEmail,
  sendSubscriptionConfirmationEmail,
  sendSubscriptionCancelEmail,
  sendPaymentMethodUpdateEmail,
  sendSuperThanksConfirmationEmail,
} from '@/lib/mailer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!
const CANCEL_AFTER_FAILED_ATTEMPTS = Number(process.env.SUBSCRIPTION_CANCEL_AFTER_FAILED_ATTEMPTS ?? 2)
const EXPECT_LIVEMODE = process.env.STRIPE_LIVE_MODE === 'true'

const getRawBody = async (req: NextRequest): Promise<string> => await req.text()

/** Webhook全体の冪等（イベント原本の記録） */
async function markEventIfNew(event: Stripe.Event) {
  const ref = adminDb.collection('stripeWebhookEvents').doc(event.id)
  const snap = await ref.get()
  if (snap.exists) return false
  await ref.set({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    created: Timestamp.fromMillis((event.created ?? 0) * 1000),
    receivedAt: Timestamp.now(),
    handled: false,
  })
  return true
}

async function setEventHandled(eventId: string) {
  await adminDb.collection('stripeWebhookEvents').doc(eventId).set(
    { handled: true, handledAt: Timestamp.now() },
    { merge: true }
  )
}

/** メール送信の冪等は emailLogs で */
async function alreadyHandledEmail(eventId: string) {
  const snap = await adminDb
    .collection('emailLogs')
    .where('source', '==', 'stripe_webhook')
    .where('eventId', '==', eventId)
    .limit(1)
    .get()
  return !snap.empty
}

/**
 * 注文確定メール送信（冪等）
 */
async function sendOrderCompletionEmailOnce(eventId: string, orderId: string, orderData: any) {
  try {
    if (await alreadyHandledEmail(eventId)) return

    const userDoc = await adminDb.collection('users').doc(orderData.userId).get()
    const userData = userDoc.data() as any | undefined
    const to = userData?.email as string | undefined
    const userName =
      userData?.displayName ||
      userData?.name ||
      (to ? to.split('@')[0] : 'ユーザー')

    if (!to) {
      await adminDb.collection('emailLogs').add({
        type: 'order_confirmation',
        orderId,
        userId: orderData?.userId ?? 'unknown',
        status: 'skipped',
        reason: 'no_email',
        eventId,
        sentAt: Timestamp.now(),
        source: 'stripe_webhook',
      })
      return
    }

    const items = Array.isArray(orderData.items)
      ? orderData.items.map((it: any) => ({
          name: it.name ?? it.id ?? '商品',
          quantity: it.quantity ?? 1,
          price: it.price ? it.price + Math.round(it.price * 0.1) : 0,
        }))
      : []

    await sendOrderConfirmationEmail({
      to,
      userName,
      orderId,
      totalJPY: orderData.total ?? 0,
      paymentType: orderData.paymentType ?? 'card',
      address: orderData.shippingInfo
        ? {
            name: orderData.shippingInfo.name,
            prefecture: orderData.shippingInfo.prefecture,
            city: orderData.shippingInfo.city,
            line1: orderData.shippingInfo.line1,
          }
        : undefined,
      items,
      shippingFeeJPY: orderData.shippingFee ?? 0,
      paidAt: new Date(),
    })

    await adminDb.collection('emailLogs').add({
      type: 'order_confirmation',
      orderId,
      userId: orderData.userId,
      recipient: to,
      status: 'sent',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
    })
  } catch (e) {
    console.error('sendOrderCompletionEmail error:', e)
    await adminDb.collection('emailLogs').add({
      type: 'order_confirmation',
      orderId,
      userId: orderData?.userId || 'unknown',
      status: 'failed',
      error: e instanceof Error ? e.message : 'Unknown error',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
    })
  }
}

/** Super Thanks確認メール送信（冪等） */
async function sendSuperThanksEmailOnce(
  eventId: string,
  orderId: string,
  orderData: any,
  superThanksItem: any
) {
  try {
    if (await alreadyHandledEmail(eventId)) {
      console.log('Super Thanks email already sent:', eventId)
      return
    }

    const userDoc = await adminDb.collection('users').doc(orderData.userId).get()
    const userData = userDoc.data() as any | undefined
    const to = userData?.email as string | undefined
    const userName =
      userData?.displayName ||
      userData?.name ||
      (to ? to.split('@')[0] : 'ユーザー')

    if (!to) {
      await adminDb.collection('emailLogs').add({
        type: 'special_cheer_confirmation',
        orderId,
        userId: orderData?.userId ?? 'unknown',
        status: 'skipped',
        reason: 'no_email',
        eventId,
        sentAt: Timestamp.now(),
        source: 'stripe_webhook',
      })
      return
    }

    await sendSuperThanksConfirmationEmail({
      to,
      userName,
      postId: superThanksItem.postId,
      postTitle: superThanksItem.postTitle || superThanksItem.name || '記事',
      groupName: superThanksItem.metadata?.groupName,
      amount: superThanksItem.price || 0,
      message: superThanksItem.metadata?.message,
      paidAt: orderData.paidAt?.toDate ? orderData.paidAt.toDate() : new Date(),
      orderId,
    })

    console.log('✓ Super Thanks confirmation email sent to:', to)

    await adminDb.collection('emailLogs').add({
      type: 'special_cheer_confirmation',
      orderId,
      userId: orderData.userId,
      recipient: to,
      status: 'sent',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
      metadata: {
        postId: superThanksItem.postId,
        amount: superThanksItem.price,
      },
    })
  } catch (e) {
    console.error('sendSuperThanksEmail error:', e)
    await adminDb.collection('emailLogs').add({
      type: 'special_cheer_confirmation',
      orderId,
      userId: orderData?.userId || 'unknown',
      status: 'failed',
      error: e instanceof Error ? e.message : 'Unknown error',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
    })
  }
}

/** サブスクリプション関連メール送信（冪等） */
async function sendSubscriptionEmailOnce(
  eventId: string,
  emailType: 'confirmation' | 'cancel' | 'payment_update',
  subscriptionId: string,
  emailData: any
) {
  try {
    if (await alreadyHandledEmail(eventId)) return

    const userDoc = await adminDb.collection('users').doc(emailData.userId).get()
    const userData = userDoc.data() as any | undefined
    const to = userData?.email as string | undefined
    const userName = userData?.displayName || userData?.name || (to ? to.split('@')[0] : 'ユーザー')

    if (!to) {
      await adminDb.collection('emailLogs').add({
        type: `subscription_${emailType}`,
        subscriptionId,
        userId: emailData.userId ?? 'unknown',
        status: 'skipped',
        reason: 'no_email',
        eventId,
        sentAt: Timestamp.now(),
        source: 'stripe_webhook',
      })
      return
    }

    switch (emailType) {
      case 'confirmation':
        await sendSubscriptionConfirmationEmail({
          to,
          userName,
          groupName: emailData.groupName,
          planType: emailData.planType,
          amount: emailData.amount,
          nextBillingDate: emailData.nextBillingDate,
          subscriptionId,
        })
        break

      case 'cancel':
        await sendSubscriptionCancelEmail({
          to,
          userName,
          groupName: emailData.groupName,
          planType: emailData.planType,
          canceledAt: emailData.canceledAt,
          periodEnd: emailData.periodEnd,
          subscriptionId,
        })
        break

      case 'payment_update':
        await sendPaymentMethodUpdateEmail({
          to,
          userName,
          groupName: emailData.groupName,
          newPaymentMethod: emailData.newPaymentMethod,
          updatedAt: emailData.updatedAt,
          ip: emailData.ip,
          ua: emailData.ua,
        })
        break
    }

    await adminDb.collection('emailLogs').add({
      type: `subscription_${emailType}`,
      subscriptionId,
      userId: emailData.userId,
      recipient: to,
      status: 'sent',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
    })
  } catch (e) {
    console.error(`sendSubscriptionEmail (${emailType}) error:`, e)
    await adminDb.collection('emailLogs').add({
      type: `subscription_${emailType}`,
      subscriptionId,
      userId: emailData?.userId || 'unknown',
      status: 'failed',
      error: e instanceof Error ? e.message : 'Unknown error',
      eventId,
      sentAt: Timestamp.now(),
      source: 'stripe_webhook',
    })
  }
}

async function reflectSubscriptionCancelInFirestore(customerId: string, subscriptionId: string) {
  const userSnap = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()
  if (userSnap.empty) return
  const userId = userSnap.docs[0].id
  const userRef = adminDb.collection('users').doc(userId)
  const user = (await userRef.get()).data() || {}
  const subs = (user as any).subscriptions || {}
  const groupId = Object.keys(subs).find((gid) => subs[gid]?.id === subscriptionId)
  if (!groupId) return

  await userRef.update({
    [`subscriptions.${groupId}.status`]: 'canceled',
    [`subscriptions.${groupId}.updatedAt`]: Timestamp.now(),
  })
}

export async function POST(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers.get('stripe-signature') as string
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    // livemodeガード
    if (typeof EXPECT_LIVEMODE === 'boolean' && event.livemode !== EXPECT_LIVEMODE) {
      await adminDb.collection('stripeWebhookEvents').doc(event.id).set(
        {
          id: event.id,
          type: event.type,
          livemode: event.livemode,
          created: Timestamp.fromMillis((event.created ?? 0) * 1000),
          receivedAt: Timestamp.now(),
          note: 'livemode mismatch. ignored',
        },
        { merge: true }
      )
      return NextResponse.json({ received: true })
    }

    // 冪等：既処理ならスキップ
    const isNew = await markEventIfNew(event)
    if (!isNew) return NextResponse.json({ received: true })

    /** PaymentIntent lifecycle */
    if (event.type === 'payment_intent.processing') {
      const pi = event.data.object as Stripe.PaymentIntent
      await adminDb.collection('orders').doc(pi.id).set(
        { paymentStatus: 'processing', updatedAt: Timestamp.now() },
        { merge: true }
      )
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent
      const orderRef = adminDb.collection('orders').doc(pi.id)
      const orderDoc = await orderRef.get()

      const uidFromMeta = (pi.metadata as any)?.uid ?? null

      if (!orderDoc.exists) {
        await orderRef.set(
          {
            id: pi.id,
            userId: uidFromMeta,
            status: 'paid',
            paymentStatus: 'succeeded',
            paidAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
          },
          { merge: true }
        )
      } else {
        await orderRef.set(
          {
            status: 'paid',
            paymentStatus: 'succeeded',
            paidAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        )
      }

      const orderData = (await orderRef.get()).data()!

      // ★ Super Thanks の場合、記事の統計を更新
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

          console.log(`✓ Super Thanks processed: ¥${amount} for post ${postId}`)

          // Super Thanks 履歴を記録
          await adminDb
            .collection('posts')
            .doc(postId)
            .collection('superThanks')
            .add({
              userId: orderData.userId,
              amount,
              message: superThanksItem.metadata?.message || null,
              orderId: pi.id,
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

              console.log(`✓ Super Thanks notification sent to ${creatorId}`)
            }
          }

          // ✅ Super Thanks確認メールを送信（購入者へ）
          sendSuperThanksEmailOnce(event.id, pi.id, orderData, superThanksItem).catch((e) =>
            console.error('Background Super Thanks email error:', e)
          )
        } catch (error) {
          console.error('Failed to update Super Thanks stats:', error)
        }
      } else {
        // 通常の注文確認メール
        sendOrderCompletionEmailOnce(event.id, pi.id, orderData).catch((e) =>
          console.error('Background email error:', e)
        )
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent
      await adminDb.collection('orders').doc(pi.id).set(
        {
          status: 'failed',
          paymentStatus: 'failed',
          failureReason: pi.last_payment_error?.message || 'Unknown error',
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    }

    if (event.type === 'payment_intent.canceled') {
      const pi = event.data.object as Stripe.PaymentIntent
      await adminDb.collection('orders').doc(pi.id).set(
        {
          status: 'canceled',
          paymentStatus: 'canceled',
          cancelReason: pi.cancellation_reason ?? 'unknown',
          canceledAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    }

    /** Checkout（銀行振込の保険） */
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_method_types?.includes('customer_balance')) {
        await adminDb.collection('orders').doc(session.id).set(
          {
            id: session.id,
            userId: session.metadata?.userId,
            paymentStatus: 'requires_action',
            status: 'pending_bank_transfer',
            hostedInstructionsUrl:
              session.url ??
              (session as any).next_action?.display_bank_transfer_instructions?.hosted_instructions_url ??
              null,
            updatedAt: Timestamp.now(),
            createdAt: Timestamp.now(),
          },
          { merge: true }
        )
      }
    }

    if (event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderRef = adminDb.collection('orders').doc(session.id)
      await orderRef.set(
        {
          status: 'paid',
          paymentStatus: 'succeeded',
          paidAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
      const orderDoc = await orderRef.get()
      if (orderDoc.exists) {
        const orderData = orderDoc.data()!

        // ★ Super Thanks処理（銀行振込の場合も同様に処理）
        const items = orderData?.items || []
        const superThanksItem = items.find((item: any) => item.itemType === 'special_cheer')

        if (superThanksItem && superThanksItem.postId) {
          const postId = superThanksItem.postId
          const amount = superThanksItem.price || 0

          try {
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

            console.log(`✓ Super Thanks processed (bank): ¥${amount} for post ${postId}`)

            await adminDb
              .collection('posts')
              .doc(postId)
              .collection('superThanks')
              .add({
                userId: orderData.userId,
                amount,
                message: superThanksItem.metadata?.message || null,
                orderId: session.id,
                paymentStatus: 'succeeded',
                createdAt: Timestamp.now(),
              })

            // クリエイターに通知
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

                console.log(`✓ Super Thanks notification sent to ${creatorId} (bank)`)
              }
            }

            // ✅ Super Thanks確認メールを送信（購入者へ）
            sendSuperThanksEmailOnce(event.id, session.id, orderData, superThanksItem).catch((e) =>
              console.error('Background Super Thanks email error:', e)
            )
          } catch (error) {
            console.error('Failed to update Super Thanks stats (bank):', error)
          }
        } else {
          // 通常の注文確認メール
          sendOrderCompletionEmailOnce(event.id, session.id, orderData).catch((e) =>
            console.error('Background email error:', e)
          )
        }
      }
    }

    /** 返金（任意） */
    if (event.type === 'charge.refunded') {
      const obj: any = event.data.object
      const paymentIntentId = obj.payment_intent || obj.charge?.payment_intent
      if (paymentIntentId) {
        await adminDb.collection('orders').doc(paymentIntentId).set(
          { status: 'refunded', paymentStatus: 'refunded', updatedAt: Timestamp.now() },
          { merge: true }
        )
      }
    }

    /** サブスク：失敗→自動キャンセル */
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const subId = invoice.subscription as string | undefined
      const customerId = invoice.customer as string | undefined
      try {
        if (subId && customerId) {
          const attempts = invoice.attempt_count ?? 1
          if (attempts >= CANCEL_AFTER_FAILED_ATTEMPTS) {
            await stripe.subscriptions.cancel(subId)
            await reflectSubscriptionCancelInFirestore(customerId, subId)
          }
        }
      } catch (e) {
        console.error('invoice.payment_failed handling error:', e)
      }
    }

    /** サブスク状態の同期 + メール送信 */
    if (event.type.startsWith('customer.subscription')) {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string

      try {
        const userSnap = await adminDb
          .collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get()

        if (!userSnap.empty) {
          const userId = userSnap.docs[0].id
          const groupId = sub.metadata?.groupId || ''

          if (groupId) {
            const planType = sub.items.data[0]?.plan.interval === 'month' ? 'monthly' : 'yearly'

            await adminDb
              .collection('users')
              .doc(userId)
              .set(
                {
                  [`subscriptions.${groupId}`]: {
                    id: sub.id,
                    status: sub.status,
                    currentPeriodEnd: Timestamp.fromMillis(sub.current_period_end * 1000),
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    planType,
                    updatedAt: Timestamp.now(),
                  },
                },
                { merge: true }
              )

            const groupDoc = await adminDb.collection('groups').doc(groupId).get()
            const groupName = groupDoc.exists ? groupDoc.data()?.name : groupId

            if (event.type === 'customer.subscription.created' && sub.status === 'active') {
              const amount = sub.items.data[0]?.price.unit_amount || 0
              sendSubscriptionEmailOnce(event.id, 'confirmation', sub.id, {
                userId,
                groupName,
                planType,
                amount: amount / 100,
                nextBillingDate: new Date(sub.current_period_end * 1000),
              }).catch((e) => console.error('Background subscription confirmation email error:', e))
            }

            if (event.type === 'customer.subscription.updated') {
              const previousAttributes = (event.data as any).previous_attributes

              if (!previousAttributes?.cancel_at_period_end && sub.cancel_at_period_end) {
                sendSubscriptionEmailOnce(event.id, 'cancel', sub.id, {
                  userId,
                  groupName,
                  planType,
                  canceledAt: new Date(),
                  periodEnd: new Date(sub.current_period_end * 1000),
                }).catch((e) => console.error('Background cancel email error:', e))
              }

              if (
                previousAttributes?.default_payment_method &&
                sub.default_payment_method &&
                previousAttributes.default_payment_method !== sub.default_payment_method
              ) {
                const pmId = sub.default_payment_method as string
                const pm = await stripe.paymentMethods.retrieve(pmId)

                if (pm.card) {
                  sendSubscriptionEmailOnce(event.id, 'payment_update', sub.id, {
                    userId,
                    groupName,
                    newPaymentMethod: {
                      brand: pm.card.brand,
                      last4: pm.card.last4,
                    },
                    updatedAt: new Date(),
                  }).catch((e) => console.error('Background payment update email error:', e))
                }
              }
            }

            if (event.type === 'customer.subscription.deleted') {
              sendSubscriptionEmailOnce(event.id, 'cancel', sub.id, {
                userId,
                groupName,
                planType,
                canceledAt: new Date(),
                periodEnd: new Date(sub.current_period_end * 1000),
              }).catch((e) => console.error('Background deletion cancel email error:', e))
            }
          }
        }
      } catch (e) {
        console.error('subscription sync error:', e)
      }
    }

    await setEventHandled(event.id)
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('Stripe webhook processing error:', e)
    return NextResponse.json({ received: true })
  }
}