import { NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
})

export async function POST(request: Request) {
  const { items, userId } = await request.json()

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items in the cart" }, { status: 400 })
  }

  try {
    // Verify user's membership status for members-only products
    const userDoc = await getDoc(doc(db, "users", userId))
    const userData = userDoc.data()
    const userSubscriptions = userData?.subscriptions || {}

    const lineItems = []
    for (const item of items) {
      const productDoc = await getDoc(doc(db, "products", item.id))
      const productData = productDoc.data()

      if (productData?.isMembersOnly) {
        const canPurchase = productData.groups.some((groupId: string) => 
          userSubscriptions[groupId]?.status === "active"
        );
        
        if (!canPurchase) {
          return NextResponse.json({ error: "Unauthorized to purchase members-only product" }, { status: 403 })
        }
      }

      lineItems.push({
        price_data: {
          currency: "jpy",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price,
        },
        quantity: item.quantity,
      })
    }

    // クーポンの適用
    const discounts = []
    if (userData?.coupon && !userData.coupon.used) {
      discounts.push({ coupon: userData.coupon.code })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      client_reference_id: userId,
      discounts: discounts,
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}

