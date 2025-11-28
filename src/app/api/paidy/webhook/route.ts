// src/app/api/paidy/webhook/route.ts
export const runtime = 'nodejs';

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendOrderConfirmationEmail } from "@/lib/mailer";

export async function POST(req: NextRequest) {
  console.log("[paidy webhook] hit");

  const rawBody = await req.text();

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error("[paidy webhook] JSON parse error:", e);
    return new Response("invalid json", { status: 400 });
  }

  const paymentId: string =
    event.payment_id ||
    event.data?.payment_id ||
    event.data?.id ||
    event.id ||
    "unknown";

  const rawEventType: string =
    event.type ||
    event.event_type ||
    "";

  const paidyStatus: string =
    event.status ||
    event.data?.status ||
    "unknown";

  const eventType: string =
    rawEventType ||
    (paidyStatus === "authorize_success"
      ? "payment.authorized"
      : paidyStatus === "close_success"
        ? "payment.captured"
        : "unknown");

  console.log("[paidy webhook] rawEventType:", rawEventType);
  console.log("[paidy webhook] normalized eventType:", eventType);
  console.log("[paidy webhook] normalized paymentId:", paymentId);
  console.log("[paidy webhook] paidyStatus:", paidyStatus);

  const docId = `${eventType}:${paymentId}`;
  const ref = adminDb.collection("webhookEvents").doc(docId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      raw: event,
      receivedAt: Date.now(),
    });
    console.log("[paidy webhook] saved webhookEvents");
  } else {
    console.log("[paidy webhook] duplicate webhookEvents, skip");
  }

  const isAuthorizedLike =
    paidyStatus === "authorize_success" ||
    paidyStatus === "authorized" ||
    eventType === "payment.authorized";

  if (isAuthorizedLike) {
    console.log("[paidy webhook] updating order as authorized/pending");

    const orderRef = adminDb.collection("orders").doc(paymentId);
    const orderSnap = await orderRef.get();

    const updateData = {
      status: "pending",
      paymentStatus: "pending",
      paymentType: "paidy",
      paymentMethod: {
        type: "paidy",
      },
      paidy_webhook_data: {
        event_type: eventType,
        status: paidyStatus,
        received_at: new Date(),
      },
      updatedAt: new Date(),
      source: "paidy-webhook",
    };

    if (orderSnap.exists) {
      const existingData = orderSnap.data();
      
      if (existingData?.userId) {
        console.log("[paidy webhook] ✓ Order belongs to user:", existingData.userId);
      }
      
      await orderRef.set(updateData, { merge: true });
      console.log("[paidy webhook] order updated");
    } else {
      console.warn("[paidy webhook] order not found, creating placeholder order");
      
      const placeholderData = {
        id: paymentId,
        userId: null,
        items: [],
        subtotalExTax: 0,
        tax: 0,
        subtotal: 0,
        shippingFee: 0,
        total: 0,
        ...updateData,
        createdAt: new Date(),
        source: "paidy-webhook-placeholder",
      };

      await orderRef.set(placeholderData);
      console.log("[paidy webhook] placeholder order created");
    }

    // ✅ オーソリ成功後、すぐにキャプチャーを実行
    console.log("[paidy webhook] 🚀 Auto-capturing payment immediately");
    try {
      const orderData = orderSnap.exists ? orderSnap.data() : null;
      
      const captureResponse = await fetch(
        `https://api.paidy.com/payments/${paymentId}/captures`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Paidy-Version": "2018-04-10",
            Authorization: `Bearer ${process.env.PAIDY_SECRET_KEY}`,
          },
          body: JSON.stringify({
            // 全額キャプチャー（金額指定する場合は orderData.total を使用）
            // amount: orderData?.total
          }),
        }
      );

      if (captureResponse.ok) {
        const captureData = await captureResponse.json();
        console.log("[paidy webhook] ✅ Auto-capture successful:", captureData);
        
        // キャプチャー成功したら即座にpaidに更新
        await orderRef.set(
          {
            paymentStatus: "paid",
            status: "paid",
            payment: { status: "captured" },
            paidy_capture_data: {
              captured_at: new Date(),
              capture_id: captureData.id || paymentId,
            },
            updatedAt: new Date(),
          },
          { merge: true }
        );
        console.log("[paidy webhook] ✅ Order marked as paid after auto-capture");

        // ✅ 決済確定メールを送信
        if (orderData && orderData.userId) {
          try {
            const userDoc = await adminDb.collection('users').doc(orderData.userId).get();
            const userData = userDoc.data();
            const userEmail = userData?.email;

            if (userEmail) {
              await sendOrderConfirmationEmail({
                to: userEmail,
                userName: userData?.displayName || userData?.name,
                orderId: paymentId,
                totalJPY: orderData.total || 0,
                paymentType: 'paidy' as any,
                address: orderData.shippingInfo ? {
                  name: orderData.shippingInfo.name,
                  prefecture: orderData.shippingInfo.prefecture,
                  city: orderData.shippingInfo.city,
                  line1: orderData.shippingInfo.line1,
                } : undefined,
                items: (orderData.items || []).map((item: any) => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                })),
                shippingFeeJPY: orderData.shippingFee || 0,
                paidAt: new Date(),
              });
              console.log("[paidy webhook] ✅ Payment confirmation email sent after auto-capture");
            }
          } catch (emailError) {
            console.error("[paidy webhook] ⚠️ Email error:", emailError);
            // メール送信失敗してもエラーにはしない
          }
        }
      } else {
        const errorText = await captureResponse.text();
        console.error("[paidy webhook] ❌ Auto-capture failed:", captureResponse.status, errorText);
        // キャプチャー失敗してもwebhookは成功として返す（リトライされる）
      }
    } catch (captureError) {
      console.error("[paidy webhook] ❌ Auto-capture exception:", captureError);
      // キャプチャー失敗してもwebhookは成功として返す
    }
  }

  const isCapturedLike =
    paidyStatus === "captured" ||
    paidyStatus === "closed" ||
    paidyStatus === "close_success" ||
    eventType === "payment.captured";

  if (isCapturedLike) {
    console.log("[paidy webhook] marking order as paid/captured");

    const orderRef = adminDb.collection("orders").doc(paymentId);
    const orderSnap = await orderRef.get();
    const orderData = orderSnap.data();

    await orderRef.set(
      {
        payment: { status: paidyStatus },
        paymentStatus: "paid",
        status: "paid",
        updatedAt: new Date(),
        source: "paidy-webhook",
      },
      { merge: true }
    );

    console.log("[paidy webhook] order marked as paid");

    // ✅ 決済確定メールを送信（手動キャプチャーの場合）
    if (orderData && orderData.userId) {
      try {
        const userDoc = await adminDb.collection('users').doc(orderData.userId).get()
        const userData = userDoc.data()
        const userEmail = userData?.email

        if (userEmail) {
          await sendOrderConfirmationEmail({
            to: userEmail,
            userName: userData?.displayName || userData?.name,
            orderId: paymentId,
            totalJPY: orderData.total || 0,
            paymentType: 'paidy' as any,
            address: orderData.shippingInfo ? {
              name: orderData.shippingInfo.name,
              prefecture: orderData.shippingInfo.prefecture,
              city: orderData.shippingInfo.city,
              line1: orderData.shippingInfo.line1,
            } : undefined,
            items: (orderData.items || []).map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            shippingFeeJPY: orderData.shippingFee || 0,
            paidAt: new Date(),
          })
          console.log("[paidy webhook] ✅ Payment confirmation email sent")
        }
      } catch (emailError) {
        console.error("[paidy webhook] ⚠️ Email error:", emailError)
        // メール送信失敗してもエラーにはしない
      }
    }
  }

  console.log("[paidy webhook] ✅ Done OK");
  return new Response("ok");
}