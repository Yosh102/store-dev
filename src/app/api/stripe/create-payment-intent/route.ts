// app/api/stripe/create-payment-intent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebase-admin'
import { getAuth } from 'firebase-admin/auth'
import { verifyCSRFToken, logCSRFFailure } from '@/lib/csrf-server'
import crypto from 'node:crypto'
import { sendOrderConfirmationEmail } from '@/lib/mailer'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

/** 税率 */
const TAX_RATE = 0.1 // 10%消費税

/** 送料/送料無料条件 */
const FIXED_SHIPPING_FEE = 800 // 送料（一律800円・税込）
const FREE_SHIPPING_THRESHOLD = 10_000 // 税抜基準
const FEEL_IT_KEYWORD = 'feel it'

type IncomingItem = {
  id: string
  name?: string
  price: number
  quantity: number
  requiresShipping?: boolean
  tags?: string[]
  selectedOptions?: any[]
  excludeTax?: boolean // ✅ Special Cheer用: 消費税除外フラグ
  itemType?: string // ✅ 'special_cheer' など
  postId?: string // ✅ Special Cheer: 記事ID
  postTitle?: string // ✅ Special Cheer: 記事タイトル
  metadata?: Record<string, any> // ✅ Special Cheer: メッセージなど
}

type ProductDoc = {
  name?: string
  tags?: string[]
  requiresShipping?: boolean
}

function includesFeelIt(str?: string) {
  return (str ?? '').toLowerCase().includes(FEEL_IT_KEYWORD)
}
function arrayHasFeelIt(arr?: string[]) {
  if (!arr?.length) return false
  return arr.some((t) => includesFeelIt(t))
}

async function fetchProductsMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, ProductDoc>()
  const refs = ids.map((id) => adminDb.collection('products').doc(id))
  const snaps = await adminDb.getAll(...refs)
  const map = new Map<string, ProductDoc>()
  snaps.forEach((snap, i) => {
    if (snap.exists) map.set(ids[i], snap.data() as ProductDoc)
  })
  return map
}

/** 税額の計算 */
function calculateTax(amount: number): number {
  return Math.round(amount * TAX_RATE)
}

async function computeTotalsServerSide(items: IncomingItem[]) {
  const ids = Array.from(new Set(items.map((it) => it.id)))
  const products = await fetchProductsMap(ids)

  // ✅ 税計算: excludeTaxがtrueの場合は消費税を加算しない
  let subtotalExcludingTax = 0
  let taxAmount = 0

  items.forEach((item) => {
    const itemSubtotal = item.price * item.quantity

    if (item.excludeTax) {
      // ✅ Special Cheer: 消費税を加算しない
      console.log(`✓ Special Cheer (Stripe): ¥${itemSubtotal}（消費税なし）`)
      subtotalExcludingTax += itemSubtotal
    } else {
      // 通常商品: 消費税を計算
      console.log(`✓ 通常商品 (Stripe): ¥${itemSubtotal}（税抜）`)
      subtotalExcludingTax += itemSubtotal
      taxAmount += calculateTax(itemSubtotal)
    }
  })

  const subtotal = subtotalExcludingTax + taxAmount // 商品合計（税込）

  const hasShippingItems = items.some((it) => {
    const prod = products.get(it.id)
    return it.requiresShipping ?? prod?.requiresShipping ?? false
  })

  // ✅ キャンペーン終了：hasFeelItItemを常にfalseにする
  const hasFeelItItem = false // キャンペーン終了

  // 送料計算（税抜基準で判定、送料自体は800円固定・税込）
  const shippingFee =
    hasShippingItems && hasFeelItItem && subtotalExcludingTax >= FREE_SHIPPING_THRESHOLD
      ? 0
      : hasShippingItems
      ? FIXED_SHIPPING_FEE
      : 0

  const total = subtotal + shippingFee

  console.log(
    `✓ Stripe税計算: 小計（税抜）¥${subtotalExcludingTax}, 消費税¥${taxAmount}, 商品合計¥${subtotal}, 送料¥${shippingFee}, 合計¥${total}`
  )

  return {
    subtotal, // 商品合計（税込）= 税抜 + 消費税
    shippingFee, // 送料（800円固定・税込）
    total, // 合計
    subtotalExcludingTax, // 税抜小計（ログ用）
    taxAmount, // 消費税額（ログ用）
  }
}

async function ensureStripeCustomer(uid: string, email?: string | null) {
  const userRef = adminDb.collection('users').doc(uid)
  const snap = await userRef.get()
  const user = snap.exists ? snap.data() : {}
  let stripeCustomerId = user?.stripeCustomerId as string | undefined

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { uid },
    })
    stripeCustomerId = customer.id
    await userRef.set({ stripeCustomerId }, { merge: true })
  }
  return stripeCustomerId
}

async function saveOrder(orderData: any) {
  const {
    paymentIntentId,
    uid,
    items,
    total,
    subtotal,
    shippingFee,
    paymentType,
    status,
    paymentStatus,
    address,
    addressId,
    paymentMethod,
    hostedInstructionsUrl,
  } = orderData

  const order = {
    id: paymentIntentId,
    userId: uid,
    items,
    total,
    subtotal,
    shippingFee,
    status,
    paymentStatus,
    paymentType,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(paymentMethod && { paymentMethod }),
    ...(hostedInstructionsUrl && { hostedInstructionsUrl }),
    ...(address && { shippingInfo: { ...address, addressId } }),
  }

  await adminDb.collection('orders').doc(paymentIntentId).set(order, { merge: true })
  return order
}

async function getPaymentMethodDetails(paymentMethodId: string) {
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (pm.card) {
      return {
        last4: pm.card.last4,
        brand: pm.card.brand,
        exp_month: pm.card.exp_month,
        exp_year: pm.card.exp_year,
      }
    }
    return {}
  } catch (e) {
    console.error('Payment method details fetch error:', e)
    return {}
  }
}

/** Bearer Firebase ID Token を検証 → uid を返す */
async function requireUid(req: NextRequest) {
  const authz = req.headers.get('authorization') || ''
  const m = authz.match(/^Bearer\s+(.+)$/i)
  if (!m) throw new Error('unauthorized')
  const idToken = m[1]
  const decoded = await getAuth().verifyIdToken(idToken)
  return decoded.uid
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyCSRFToken(request)) {
      await logCSRFFailure(request, '/api/stripe/create-payment-intent', adminDb)
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
    // 1) 本人認証
    const uid = await requireUid(request)

    // 2) ペイロード（clientのuserId/customerIdは信用しない）
    const {
      items,
      paymentMethodId,
      address,
      addressId,
      paymentType,
    }: {
      items: IncomingItem[]
      paymentMethodId?: string
      address?: any
      addressId?: string
      paymentType: 'card' | 'bank_transfer'
    } = await request.json()

    if (!Array.isArray(items) || !paymentType) {
      return NextResponse.json({ error: '必要なパラメーターが不足しています' }, { status: 400 })
    }

    // 3) サーバーで合計計算
    const { subtotal, shippingFee, total, subtotalExcludingTax, taxAmount } =
      await computeTotalsServerSide(items)

    console.log(
      `✓ Stripe税計算: 小計（税抜）¥${subtotalExcludingTax}, 消費税¥${taxAmount}, 商品合計¥${subtotal}, 送料¥${shippingFee}, 合計¥${total}`
    )

    // 4) Stripe customer をDBから解決（なければ作成）
    const userDoc = await adminDb.collection('users').doc(uid).get()
    const userData = userDoc.exists ? (userDoc.data() as any) : {}
    const stripeCustomerId = await ensureStripeCustomer(uid, userData?.email)

    // 5) 冪等キー（uid + items + total）
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(JSON.stringify({ uid, items, total, t: Date.now() }))
      .digest('hex')

    /** ===== カード決済 ===== */
    if (paymentType === 'card') {
      if (!paymentMethodId) {
        return NextResponse.json({ error: 'paymentMethodId が必要です' }, { status: 400 })
      }

      // ✅ CRITICAL: metadataに完全な情報を保存
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: total, // ✅ 合計金額（Special Cheerの場合は消費税なし）
          currency: 'jpy',
          customer: stripeCustomerId,
          payment_method: paymentMethodId,
          confirm: true,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/order/success`,
          metadata: {
            uid,
            paymentType: 'card',
            // ✅ CRITICAL: 完全なitem情報を保存（Special Cheer判定に必要）
            items: JSON.stringify(
              items.map((i) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                itemType: i.itemType, // ✅ 'special_cheer'
                postId: i.postId, // ✅ 記事ID
                postTitle: i.postTitle, // ✅ 記事タイトル
                excludeTax: i.excludeTax, // ✅ 消費税除外フラグ
                metadata: i.metadata ? JSON.stringify(i.metadata) : undefined, // ✅ メッセージなど
              }))
            ),
          },
        },
        { idempotencyKey }
      )

      const paymentMethodDetails = await getPaymentMethodDetails(paymentMethodId)

      const provisionalStatus =
        paymentIntent.status === 'succeeded'
          ? 'paid'
          : paymentIntent.status === 'requires_action'
          ? 'pending_action'
          : paymentIntent.status === 'processing'
          ? 'processing'
          : 'pending'

      await saveOrder({
        paymentIntentId: paymentIntent.id,
        uid,
        items,
        total,
        subtotal,
        shippingFee,
        paymentType: 'card',
        status: provisionalStatus,
        paymentStatus: paymentIntent.status,
        address,
        addressId,
        paymentMethod: { type: 'card', ...paymentMethodDetails },
      })

      if (paymentIntent.status === 'requires_action' && paymentIntent.client_secret) {
        return NextResponse.json({
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
          requiresAction: true,
        })
      }

      if (paymentIntent.status === 'requires_payment_method') {
        return NextResponse.json(
          {
            error:
              paymentIntent.last_payment_error?.message ||
              'カードの認証/決済に失敗しました。別カードでお試しください。',
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
          },
          { status: 402 }
        )
      }

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        clientSecret: paymentIntent.client_secret,
      })
    }

    /** ===== 銀行振込 ===== */
    if (paymentType === 'bank_transfer') {
      // ✅ CRITICAL: metadataに完全な情報を保存
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: total, // ✅ 合計金額（Special Cheerの場合は消費税なし）
          currency: 'jpy',
          customer: stripeCustomerId,
          payment_method_types: ['customer_balance'],
          payment_method_data: { type: 'customer_balance' },
          confirm: true,
          payment_method_options: {
            customer_balance: {
              funding_type: 'bank_transfer',
              bank_transfer: { type: 'jp_bank_transfer' },
            },
          },
          metadata: {
            uid,
            paymentType: 'bank_transfer',
            // ✅ CRITICAL: 完全なitem情報を保存
            items: JSON.stringify(
              items.map((i) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                price: i.price,
                itemType: i.itemType, // ✅ 'special_cheer'
                postId: i.postId, // ✅ 記事ID
                postTitle: i.postTitle, // ✅ 記事タイトル
                excludeTax: i.excludeTax, // ✅ 消費税除外フラグ
                metadata: i.metadata ? JSON.stringify(i.metadata) : undefined, // ✅ メッセージなど
              }))
            ),
          },
        },
        { idempotencyKey }
      )

      const hostedInstructionsUrl =
        paymentIntent.next_action?.display_bank_transfer_instructions?.hosted_instructions_url

      await saveOrder({
        paymentIntentId: paymentIntent.id,
        uid,
        items,
        total,
        subtotal,
        shippingFee,
        paymentType: 'bank_transfer',
        status: 'pending_bank_transfer',
        paymentStatus: paymentIntent.status,
        address,
        addressId,
        hostedInstructionsUrl,
      })

      // ★ 銀行振込の「注文受付/支払い案内」メールを即時送信（確定メールは webhook 側）
      try {
        const to = userData?.email
        if (to) {
          await sendOrderConfirmationEmail({
            to,
            userName: userData?.displayName || userData?.name || to.split('@')[0],
            orderId: paymentIntent.id,
            totalJPY: total,
            paymentType: 'bank_transfer',
            // ✅ FIX: 価格は既に計算済み（税込 or Special Cheerは額面通り）
            items: items.map((i) => ({
              name: i.name ?? i.id,
              quantity: i.quantity,
              price: i.excludeTax
                ? i.price // Special Cheer: 額面通り
                : i.price + calculateTax(i.price), // 通常商品: 税込
            })),
            shippingFeeJPY: shippingFee,
            // paidAt は未入金なので渡さない → 「受付/案内」文面になる
            bankInstructionsUrl: hostedInstructionsUrl || undefined,
            address: address
              ? {
                  name: address?.name,
                  prefecture: address?.prefecture,
                  city: address?.city,
                  line1: address?.line1,
                }
              : undefined,
          })
        }
      } catch (e) {
        console.error('銀行振込の案内メール送信エラー:', e)
        // 失敗しても決済フロー自体は続行
      }

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        hostedInstructionsUrl,
      })
    }

    return NextResponse.json({ error: '無効な決済タイプです' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('create-payment-intent error:', error)
    return NextResponse.json({ error: '決済処理中にエラーが発生しました' }, { status: 500 })
  }
}