// src/app/api/jamm/create-session/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, verifyFirebaseToken } from '@/lib/firebase-admin'
import { jamm } from '@/lib/jamm'

export async function POST(req: NextRequest) {
  console.log('[/api/jamm/create-session] HIT')

  try {
    /* ───────── ① Firebase 認証 (あれば) ───────── */
    const authHeader = req.headers.get('Authorization')
    let uid: string | null = null
    let userEmail: string | null = null

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const decoded = await verifyFirebaseToken(token)
      if (decoded) {
        uid = decoded.uid
        userEmail = (decoded as any).email ?? null
        console.log('[/api/jamm/create-session] auth uid:', uid, 'email:', userEmail)
      } else {
        console.warn('[/api/jamm/create-session] invalid auth token, continue as guest')
      }
    } else {
      console.warn('[/api/jamm/create-session] no auth header')
    }

    /* ───────── ② リクエスト body ───────── */
    const body = await req.json()
    console.log('[/api/jamm/create-session] body:', JSON.stringify(body).slice(0, 500))

    const { items, address, successUrl, failureUrl } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items is required' }, { status: 400 })
    }
    if (!successUrl || !failureUrl) {
      return NextResponse.json(
        { error: 'successUrl and failureUrl are required' },
        { status: 400 },
      )
    }

    /* ───────── ③ 金額計算 (サーバー側で再計算) ───────── */
    const TAX_RATE = 0.1

    const subtotalExTax = items.reduce(
      (sum: number, item: any) => sum + Number(item.price) * Number(item.quantity ?? 1),
      0,
    )
    const tax = Math.round(subtotalExTax * TAX_RATE)
    const subtotal = subtotalExTax + tax

    const hasAddress = !!address
    const shippingFee = hasAddress ? 800 : 0
    const total = subtotal + shippingFee

    console.log('[/api/jamm/create-session] amounts:', {
      subtotalExTax,
      tax,
      subtotal,
      shippingFee,
      total,
    })

    /* ───────── ④ 仮の orderId ───────── */
    const tempOrderId = `jamm_temp_${Date.now()}`

    /* ───────── ⑤ buyer 情報を組み立て (バリデーション対応) ───────── */

    // 電話番号: 数字だけ残して 070/080/090 + 8桁 形式に合わせる
    const rawPhone: string =
      (address?.phoneNumber as string | undefined) ??
      process.env.JAMM_TEST_PHONE ??
      '08000000000'
    const normalizedPhone = rawPhone.replace(/\D/g, '')

    let buyerPhone = normalizedPhone
    if (!/^0[789]0[0-9]{8}$/.test(buyerPhone)) {
      // NGなときはテスト用の番号にフォールバック
      buyerPhone = '08000000000'
    }

    // 名前: なければダミー文字列
    const buyerName: string =
      (address?.name as string | undefined)?.trim() || 'PLAYTUNE ユーザー'

    // 住所: 5文字以上必要なので、なければテスト住所
    const buyerAddressStr: string = hasAddress
      ? `${address.prefecture ?? ''}${address.city ?? ''}${address.line1 ?? ''}${
          address.line2 ?? ''
        }`.trim() || '東京都渋谷区テスト1-1-1'
      : '東京都渋谷区テスト1-1-1'

    // メール: address.email → Firebase の email → テスト用 の順で fallback
    const buyerEmail: string =
      (address?.email as string | undefined) ||
      userEmail ||
      'test@example.com'

    // nameKana があるときだけ、カタカナを分割して送る
    let katakanaLastName: string | undefined
    let katakanaFirstName: string | undefined
    if (address?.nameKana) {
      const kana = String(address.nameKana).trim()
      const [lastKana, firstKana] = kana.split(/\s+/)
      katakanaLastName = lastKana || undefined
      katakanaFirstName = firstKana || undefined
    }

    // ★ Jamm API のフィールド名は snake_case に合わせる
    const buyer: any = {
      email: buyerEmail,
      force_kyc: true,
      phone: buyerPhone,
      name: buyerName,
      address: buyerAddressStr,
      metadata: {
        firebaseUid: uid ?? '',
        source: 'playtune-store',
        tempOrderId,
      },
    }

    if (katakanaLastName) {
      buyer.katakana_last_name = katakanaLastName
    }
    if (katakanaFirstName) {
      buyer.katakana_first_name = katakanaFirstName
    }

    /* ───────── ⑥ Jamm On-Session Payment 作成 ───────── */

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const payment = await jamm.payment.onSessionPayment({
      buyer,
      charge: {
        price: total,
        description: 'PLAY TUNE STORE order via Jamm',
        expiresAt,
        metadata: {
          tempOrderId,
        },
      },
      redirect: {
        successUrl,
        failureUrl,
      },
    })

    console.log(
      '[/api/jamm/create-session] Jamm payment raw:',
      JSON.stringify(payment, null, 2),
    )

    // Jamm SDK のレスポンスは { success: true, data: { ... } } なので、まず data を見る
    const payload: any = (payment as any)?.data ?? payment

    // ★ ここで customerId / contractId を拾う
    const jammCustomerId: string | undefined =
      payload?.customer?.id ??
      (payment as any)?.customer?.id

    const jammContractId: string | undefined =
      payload?.contract?.id ??
      (payment as any)?.contract?.id

    const jammChargeId: string | undefined =
      payload?.charge?.id ??
      payload?.chargeId ??
      (payment as any)?.charge?.id ??
      (payment as any)?.id

    const redirectUrl: string | undefined =
      payload?.paymentLink?.url ??
      payload?.payment_link?.url ??
      payload?.payment_url ??
      (payment as any)?.paymentLink?.url ??
      (payment as any)?.payment_link?.url ??
      (payment as any)?.payment_url

    if (!jammChargeId || !redirectUrl) {
      console.error('[/api/jamm/create-session] invalid Jamm response:', payment)
      return NextResponse.json(
        { error: 'Invalid Jamm response (missing url or charge id)' },
        { status: 500 },
      )
    }

    const orderDocId = `jamm_${jammChargeId}`

    /* ───────── ⑦ Firestore に注文保存 (pending) ───────── */
    const orderRef = adminDb.collection('orders').doc(orderDocId)
    await orderRef.set(
      {
        id: orderDocId,
        jammChargeId,
        // ★ ここで Jamm の customer / contract も紐付けておく
        jammCustomerId: jammCustomerId ?? null,
        jammContractId: jammContractId ?? null,

        userId: uid ?? null,
        items,
        subtotalExTax,
        tax,
        subtotal,
        shippingFee,
        total,
        paymentType: 'jamm',
        paymentStatus: 'pending',
        status: 'pending',
        address: address ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'jamm-create-session',
      },
      { merge: true },
    )

    console.log('[/api/jamm/create-session] order stored:', orderDocId)

    /* ───────── ⑦.5 ユーザーに Jamm の customerId を保存 ───────── */
    if (uid && jammCustomerId) {
      try {
        const userRef = adminDb.collection('users').doc(uid)

        const jammData: any = {
          customerId: jammCustomerId,
          updatedAt: new Date(),
        }

        if (jammContractId) {
          jammData.lastContractId = jammContractId
        }

        await userRef.set(
          {
            jamm: jammData, // ★ ネストして保存
          },
          { merge: true },
        )

        console.log('[/api/jamm/create-session] user updated with Jamm IDs:', {
          uid,
          jammCustomerId,
          jammContractId,
        })
      } catch (e) {
        // ここは決済自体には影響しないので、ログだけ出して続行
        console.error('[/api/jamm/create-session] failed to save Jamm IDs to user:', e)
      }
    }
    /* ───────── ⑧ フロントに返す ───────── */
    return NextResponse.json({
      redirectUrl,
      chargeId: jammChargeId,
      orderId: orderDocId,
    })
  } catch (err: any) {
    // Jamm の ConnectError などは rawMessage に詳しい理由が来る
    console.error('[/api/jamm/create-session] error:', err)

    const message =
      err?.rawMessage ||
      err?.message ||
      'Failed to create Jamm session'

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}