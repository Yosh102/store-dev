// src/app/api/paypay/create-code/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { paypayRequest } from '@/lib/paypay/http'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { Timestamp } from 'firebase-admin/firestore'
import crypto from 'crypto'

/* ================== セキュリティ: CSRF保護 ================== */

/**
 * CSRFトークンを検証
 * @param req NextRequest
 * @returns トークンが有効ならtrue
 */
function verifyCSRFToken(req: NextRequest): boolean {
  const headerToken = req.headers.get('x-csrf-token')
  const cookieToken = req.cookies.get('csrf_token')?.value

  if (!headerToken || !cookieToken) {
    console.error('CSRF token missing:', {
      hasHeader: !!headerToken,
      hasCookie: !!cookieToken,
    })
    return false
  }

  try {
    const headerBuf = Buffer.from(headerToken)
    const cookieBuf = Buffer.from(cookieToken)

    if (headerBuf.length !== cookieBuf.length) {
      console.error('CSRF token length mismatch')
      return false
    }

    const isValid = crypto.timingSafeEqual(headerBuf, cookieBuf)

    if (!isValid) {
      console.error('CSRF token mismatch')
    }

    return isValid
  } catch (error) {
    console.error('CSRF token verification error:', error)
    return false
  }
}

/* ================== Stripe 側と揃えた定数/ヘルパ ================== */
const TAX_RATE = 0.1 // 10%消費税
const FIXED_SHIPPING_FEE = 800 // 送料（一律800円・税込）
const FREE_SHIPPING_THRESHOLD = 10_000 // 税抜基準
const FEEL_IT_KEYWORD = 'feel it'

type IncomingItem = {
  id: string
  name?: string
  price: number
  quantity: number
  requiresShipping?: boolean
  selectedOptions?: any[]
  tags?: string[]
  excludeTax?: boolean // ✅ Special Cheer用: 消費税除外フラグ
  itemType?: string // ✅ 'special_cheer' など
  postId?: string // ✅ Special Cheer: 記事ID
  postTitle?: string // ✅ Special Cheer: 記事タイトル
  metadata?: Record<string, any> // ✅ Special Cheer: メッセージなど
}

type ProductDoc = {
  name?: string
  images?: string[]
  requiresShipping?: boolean
  tags?: string[]
}

type Address = {
  id?: string
  name?: string
  postalCode?: string
  prefecture?: string
  city?: string
  line1?: string
  line2?: string
  phone?: string
}

function includesFeelIt(str?: string) {
  return (str ?? '').toLowerCase().includes(FEEL_IT_KEYWORD)
}

function arrayHasFeelIt(arr?: string[]) {
  if (!arr?.length) return false
  return arr.some((t) => includesFeelIt(t))
}

async function fetchProductsMap(ids: string[]) {
  if (!ids.length) return new Map<string, ProductDoc>()
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

async function normalizeAndCompute(items: IncomingItem[]) {
  const ids = Array.from(new Set(items.map((it) => it.id)))
  const products = await fetchProductsMap(ids)

  const normalized = items.map((it) => {
    const prod = products.get(it.id)
    return {
      id: it.id,
      name: it.name ?? prod?.name ?? it.id,
      price: it.price,
      quantity: it.quantity,
      requiresShipping: (it.requiresShipping ?? prod?.requiresShipping) || false,
      selectedOptions: it.selectedOptions ?? [],
      images: prod?.images ?? [],
      tags: it.tags ?? prod?.tags ?? [],
      excludeTax: it.excludeTax || false, // ✅ フラグを保持
      itemType: it.itemType, // ✅ 'special_cheer'
      postId: it.postId, // ✅ 記事ID
      postTitle: it.postTitle, // ✅ 記事タイトル
      metadata: it.metadata, // ✅ メッセージなど
    }
  })

  // ✅ 税計算: excludeTaxがtrueの場合は消費税を加算しない
  let subtotalExcludingTax = 0
  let taxAmount = 0

  items.forEach((item) => {
    const itemSubtotal = item.price * item.quantity

    if (item.excludeTax) {
      // ✅ Special Cheer: 消費税を加算しない
      console.log(`✓ Special Cheer (PayPay): ¥${itemSubtotal}（消費税なし）`)
      subtotalExcludingTax += itemSubtotal
    } else {
      // 通常商品: 消費税を計算
      console.log(`✓ 通常商品 (PayPay): ¥${itemSubtotal}（税抜）`)
      subtotalExcludingTax += itemSubtotal
      taxAmount += calculateTax(itemSubtotal)
    }
  })

  const subtotal = subtotalExcludingTax + taxAmount // 商品合計（税込）

  const hasShippingItems = normalized.some((it) => it.requiresShipping === true)

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
    `✓ PayPay税計算: 小計（税抜）¥${subtotalExcludingTax}, 消費税¥${taxAmount}, 商品合計¥${subtotal}, 送料¥${shippingFee}, 合計¥${total}`
  )

  return {
    normalized,
    subtotal, // 商品合計（税込）= 税抜 + 消費税
    shippingFee, // 送料（800円固定・税込）
    total, // 合計
    hasShippingItems,
    subtotalExcludingTax, // 税抜小計（ログ用）
    taxAmount, // 消費税額（ログ用）
  }
}

/* ================== PayPay SDK 型 ================== */
type CreateCodeReq = {
  merchantPaymentId: string
  amount: { amount: number; currency: 'JPY' }
  codeType: 'ORDER_QR'
  orderDescription?: string
  requestedAt: number
  redirectUrl?: string
  redirectType?: 'WEB_LINK' | 'APP_DEEP_LINK'
  userAgent?: string
}

type CreateCodeRes = {
  resultInfo: { code: string; message: string; codeId?: string }
  data?: {
    codeId: string
    url?: string
    deeplink?: string
    expiryDate: number
    merchantPaymentId: string
  }
}

/* ================== Handler ================== */
export async function POST(req: NextRequest) {
  try {
    // feature flag
    if (process.env.ENABLE_PAYPAY !== 'true' && process.env.NEXT_PUBLIC_ENABLE_PAYPAY !== 'true') {
      return NextResponse.json({ error: 'PayPay disabled' }, { status: 400 })
    }

    // ✅ CRITICAL: CSRF保護を追加
    if (!verifyCSRFToken(req)) {
      await adminDb
        .collection('securityLogs')
        .add({
          type: 'csrf_token_failure',
          endpoint: '/api/paypay/create-code',
          timestamp: Timestamp.now(),
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown',
        })
        .catch((err) => console.error('Failed to log CSRF failure:', err))

      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }

    console.log('✓ CSRF token verified')

    // ---- 認証（Firebase ID Token）----
    const authz = req.headers.get('authorization') || req.headers.get('Authorization')
    if (!authz?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const idToken = authz.slice('Bearer '.length).trim()
    let decoded: { uid: string }
    try {
      decoded = await adminAuth.verifyIdToken(idToken)
    } catch {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }

    // ---- 入力取得 ----
    const { items, userId, userAgent, addressId, address } = (await req.json()) as {
      items: IncomingItem[]
      userId: string
      userAgent?: string
      addressId?: string | null
      address?: Address | null
    }

    // userId なりすまし防止
    if (!userId || userId !== decoded.uid) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // items バリデーション
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'invalid items' }, { status: 400 })
    }
    for (const it of items) {
      const hasId = typeof it?.id === 'string' && it.id.length > 0
      const qtyOk = Number.isInteger(it?.quantity) && it.quantity > 0 && it.quantity <= 99
      const priceOk = Number.isInteger(it?.price) && it.price >= 0 && it.price <= 1_000_000
      if (!hasId || !qtyOk || !priceOk) {
        return NextResponse.json({ error: 'invalid item values' }, { status: 400 })
      }
    }

    // ---- items を正規化し、送料含む totals を算出 ----
    const { normalized, subtotal, shippingFee, total, hasShippingItems } =
      await normalizeAndCompute(items)

    // 金額の合理的範囲
    if (!Number.isInteger(total) || total < 100 || total > 2_200_000) {
      return NextResponse.json({ error: 'amount_out_of_range' }, { status: 400 })
    }

    // ---- 住所の取得/検証 ----
    let shippingAddress: Address | null = null
    if (hasShippingItems) {
      if (addressId) {
        const addrRef = adminDb
          .collection('users')
          .doc(userId)
          .collection('addresses')
          .doc(addressId)
        const snap = await addrRef.get()
        if (snap.exists) {
          shippingAddress = { id: snap.id, ...(snap.data() as Address) }
        }
      }
      if (!shippingAddress && address) {
        shippingAddress = address
      }
      if (
        !shippingAddress ||
        !shippingAddress.prefecture ||
        !shippingAddress.city ||
        !shippingAddress.line1
      ) {
        return NextResponse.json({ error: 'address_required' }, { status: 400 })
      }
    }

    // ---- 注文ID生成（UUIDで予測不可能に）----
    const randomId = crypto.randomUUID().replace(/-/g, '')
    const merchantPaymentId = `pp_${Date.now()}_${randomId}`
    const now = Timestamp.now()

    const base = process.env.NEXT_PUBLIC_APP_URL!
    const pollUrl = `${base}/api/paypay/native/status?orderId=${merchantPaymentId}`
    const redirectUrl = `${base}/order/success?orderId=${merchantPaymentId}&type=paypay_native&status=pending&poll=${encodeURIComponent(
      pollUrl
    )}`

    const orderRef = adminDb.collection('orders').doc(merchantPaymentId)
    await orderRef.set(
      {
        id: merchantPaymentId,
        userId,
        items: normalized,
        subtotal, // 商品合計（税込）
        shippingFee, // 送料（800円固定・税込）
        total, // 合計
        shippingRequired: hasShippingItems,
        addressId: hasShippingItems ? (shippingAddress?.id ?? null) : null,
        shippingInfo: hasShippingItems
          ? { ...shippingAddress, addressId: shippingAddress?.id }
          : null,
        paymentType: 'paypay',
        provider: 'paypay_direct',
        status: 'pending_paypay_native',
        paymentStatus: 'pending',
        userAgent: userAgent || null,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    )

    // ---- PayPay へ作成リクエスト ----
    const payload: CreateCodeReq = {
      merchantPaymentId,
      amount: { amount: total, currency: 'JPY' }, // ✅ 合計金額（Special Cheerの場合は消費税なし）
      codeType: 'ORDER_QR',
      orderDescription: 'PLAYTUNE STORE',
      requestedAt: Math.floor(Date.now() / 1000),
      redirectUrl,
      redirectType: 'WEB_LINK',
      userAgent,
    }

    const res = await paypayRequest<CreateCodeRes>({
      method: 'POST',
      path: '/v2/codes',
      json: payload,
    })

    if (res?.resultInfo?.code !== 'SUCCESS' || !res?.data) {
      await orderRef.set(
        {
          status: 'failed',
          paymentStatus: 'failed',
          paypayError: res?.resultInfo || res,
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )

      return NextResponse.json({ error: 'Payment creation failed' }, { status: 502 })
    }

    // 成功を記録
    await orderRef.set(
      {
        paypay: {
          codeId: res.data.codeId,
          expiryDate: res.data.expiryDate ? Timestamp.fromMillis(res.data.expiryDate) : null,
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )

    const cashierUrl = res.data.url || res.data.deeplink

    return NextResponse.json({
      merchantPaymentId,
      cashierUrl,
      pollUrl,
    })
  } catch (e: any) {
    console.error('PayPay create-code error:', e?.message || e)
    return NextResponse.json({ error: 'Payment creation failed' }, { status: 500 })
  }
}