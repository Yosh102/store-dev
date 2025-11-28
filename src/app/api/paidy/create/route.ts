// src/app/api/paidy/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb, verifyFirebaseToken } from "@/lib/firebase-admin";
import { verifyCSRFToken } from "@/lib/csrf-server";
import { sendOrderConfirmationEmail } from "@/lib/mailer"; 

/* ================== 型定義 ================== */
type IncomingItem = {
  id: string
  name?: string
  price: number
  quantity: number
  requiresShipping?: boolean
  selectedOptions?: any[]
  excludeTax?: boolean
  itemType?: string
  postId?: string
  postTitle?: string
  metadata?: Record<string, any>
}

type ProductDoc = {
  name?: string
  images?: string[]
  requiresShipping?: boolean
  price?: number
  tags?: string[]
}

/* ================== ヘルパー関数 ================== */
async function fetchProductsMap(ids: string[]): Promise<Map<string, ProductDoc>> {
  if (!ids.length) return new Map<string, ProductDoc>()
  
  const refs = ids.map((id) => adminDb.collection('products').doc(id))
  const snaps = await adminDb.getAll(...refs)
  
  const map = new Map<string, ProductDoc>()
  snaps.forEach((snap, i) => {
    if (snap.exists) {
      map.set(ids[i], snap.data() as ProductDoc)
    }
  })
  
  return map
}

async function normalizeAndValidateItems(items: IncomingItem[]) {
  const productIds = Array.from(
    new Set(
      items
        .filter((it) => it.itemType !== 'special_cheer')
        .map((it) => it.id)
    )
  )

  const products = await fetchProductsMap(productIds)
  const normalized = []
  
  for (const item of items) {
    if (item.itemType === 'special_cheer') {
      console.log(`✓ Special Cheer detected: ${item.name || item.postTitle}`)
      normalized.push({
        id: item.id,
        name: item.name || item.postTitle || 'Special Cheer',
        price: item.price,
        quantity: item.quantity,
        requiresShipping: false,
        selectedOptions: [],
        images: [],
        tags: [],
        excludeTax: true,
        itemType: 'special_cheer',
        postId: item.postId,
        postTitle: item.postTitle,
        metadata: item.metadata,
      })
      continue
    }

    const prod = products.get(item.id)
    
    if (!prod) {
      console.error(`[paidy/create] Product not found: ${item.id}`)
      throw new Error(`商品が見つかりません: ${item.id}`)
    }

    if (prod.price && item.selectedOptions && item.selectedOptions.length > 0) {
      const basePrice = prod.price
      const optionsTotal = item.selectedOptions.reduce(
        (sum, opt) => sum + (opt.priceModifier || 0),
        0
      )
      const expectedPrice = basePrice + optionsTotal
      
      if (Math.abs(item.price - expectedPrice) > 1) {
        console.error(`[paidy/create] Price mismatch for ${item.id}`)
        throw new Error(`商品価格が一致しません: ${item.name || prod.name}`)
      }
    } else if (prod.price && Math.abs(item.price - prod.price) > 1) {
      console.error(`[paidy/create] Price mismatch for ${item.id}`)
      throw new Error(`商品価格が一致しません: ${item.name || prod.name}`)
    }

    normalized.push({
      id: item.id,
      name: item.name || prod.name || item.id,
      price: item.price,
      quantity: item.quantity,
      requiresShipping: item.requiresShipping ?? prod.requiresShipping ?? false,
      selectedOptions: item.selectedOptions || [],
      images: prod.images || [],
      tags: prod.tags || [],
      excludeTax: false,
    })
  }

  return normalized
}

/* ================== メインハンドラ ================== */
export async function POST(req: NextRequest) {
  console.log("[/api/paidy/create] HIT");
  
  try {
    const isValidCSRF = await verifyCSRFToken(req);
    if (!isValidCSRF) {
      console.error("[/api/paidy/create] CSRF verification failed");
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 403 }
      );
    }

    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("[/api/paidy/create] Missing authorization");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token);
    
    if (!decodedToken) {
      console.error("[/api/paidy/create] Invalid token");
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    const uid = decodedToken.uid;
    console.log("[/api/paidy/create] ✓ Auth verified for uid:", uid);

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("[/api/paidy/create] JSON parse error");
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      paymentId,
      items,
      shippingFee,
      shippingInfo,
    } = body;

    if (!paymentId || typeof paymentId !== 'string' || !paymentId.startsWith('pay_')) {
      console.error("[/api/paidy/create] Invalid paymentId");
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      console.error("[/api/paidy/create] Invalid items");
      return NextResponse.json(
        { error: "Invalid items" },
        { status: 400 }
      );
    }

    for (const item of items) {
      const hasId = typeof item?.id === 'string' && item.id.length > 0
      const qtyOk = Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 99
      const priceOk = Number.isInteger(item?.price) && item.price >= 0 && item.price <= 1_000_000
      
      if (!hasId || !qtyOk || !priceOk) {
        console.error("[/api/paidy/create] Invalid item values:", item)
        return NextResponse.json(
          { error: "Invalid item values" },
          { status: 400 }
        );
      }
    }

    let normalizedItems
    try {
      normalizedItems = await normalizeAndValidateItems(items)
    } catch (error: any) {
      console.error("[/api/paidy/create] Item validation failed:", error.message)
      return NextResponse.json(
        { error: error.message || "商品情報の検証に失敗しました" },
        { status: 400 }
      );
    }

    const taxRate = 0.1
    let subtotalExTax = 0
    let taxAmount = 0

    for (const item of normalizedItems) {
      const itemSubtotal = item.price * item.quantity

      if (item.excludeTax) {
        console.log(`✓ Special Cheer (Paidy): ¥${itemSubtotal}（消費税なし）`)
        subtotalExTax += itemSubtotal
      } else {
        console.log(`✓ 通常商品 (Paidy): ¥${itemSubtotal}（税抜）`)
        subtotalExTax += itemSubtotal
        taxAmount += Math.round(itemSubtotal * taxRate)
      }
    }

    const subtotal = subtotalExTax + taxAmount
    const shipping = Number(shippingFee ?? 0)
    const total = Math.round(subtotal + shipping)

    if (total > 50000000) {
      console.error("[/api/paidy/create] Amount too large");
      return NextResponse.json(
        { error: "Order amount exceeds limit" },
        { status: 400 }
      );
    }

    console.log("[/api/paidy/create] Calculated amounts:", {
      subtotalExTax,
      taxAmount,
      subtotal,
      shipping,
      total,
    });

    const orderRef = adminDb.collection("orders").doc(paymentId);
    const existingOrder = await orderRef.get();
    
    if (existingOrder.exists) {
      const existingData = existingOrder.data();
      
      if (existingData?.userId !== uid) {
        console.error("[/api/paidy/create] Payment ID conflict");
        return NextResponse.json(
          { error: "Payment ID already exists" },
          { status: 409 }
        );
      }
      
      console.log("[/api/paidy/create] Order already exists");
      return NextResponse.json({
        id: paymentId,
        status: existingData?.status || "pending",
        amount: existingData?.total || total,
      });
    }

    await orderRef.set({
      id: paymentId,
      userId: uid,
      items: normalizedItems,
      subtotalExTax,
      tax: taxAmount,
      subtotal,
      shippingFee: shipping,
      total,
      status: "pending",
      paymentStatus: "pending",
      paymentType: "paidy",
      paymentMethod: { 
        type: "paidy",
        firebase_uid: uid,
      },
      shippingInfo: shippingInfo || null,
      metadata: {
        firebase_uid: uid,
        order_source: 'paidy-create',
        created_from: 'api',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      source: "paidy-create",
    });

    console.log("[/api/paidy/create] ✓ Order created:", paymentId);

    // ✅ 注文受付メールを送信
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get()
      const userData = userDoc.data()
      const userEmail = decodedToken.email || userData?.email
      const userName = userData?.displayName || userData?.name

      if (userEmail) {
        await sendOrderConfirmationEmail({
          to: userEmail,
          userName,
          orderId: paymentId,
          totalJPY: total,
          paymentType: 'paidy' as any, // ✅ paidyを追加
          address: shippingInfo ? {
            name: shippingInfo.name,
            prefecture: shippingInfo.prefecture,
            city: shippingInfo.city,
            line1: shippingInfo.line1,
          } : undefined,
          items: normalizedItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          shippingFeeJPY: shipping,
          // paidAtは渡さない（まだ未確定なので）
        })
        console.log("[/api/paidy/create] ✓ Order confirmation email sent")
      }
    } catch (emailError) {
      console.error("[/api/paidy/create] Email error:", emailError)
      // メール送信失敗してもエラーにはしない
    }

    return NextResponse.json({
      id: paymentId,
      status: "pending",
      amount: total,
    });

  } catch (err: any) {
    console.error("[/api/paidy/create] Error:", err?.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.error("[/api/paidy/create] Stack:", err?.stack);
    }
    
    return NextResponse.json(
      { error: "Failed to process order" },
      { status: 500 }
    );
  }
}