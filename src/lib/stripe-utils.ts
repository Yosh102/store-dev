//lib/srtipe-utils.ts
import { db } from "./firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { FirebaseError } from "firebase/app"

export async function createCouponForUser(userId: string): Promise<string> {
  try {
    // キャンペーンクーポン情報を取得
    const campaignDoc = await getDoc(doc(db, "campaigns", "current"))
    let campaignData = campaignDoc.data()

    if (!campaignDoc.exists() || !campaignData || !campaignData.stripeCouponId) {
      // console.warn("Campaign not found or invalid. Using default values.")
      campaignData = {
        stripeCouponId: "default_coupon_id",
        percentOff: 10,
      }
    }

    // サーバーサイドAPIを呼び出してクーポンを作成
    const response = await fetch("/api/create-coupon", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        percentOff: campaignData.percentOff,
        stripeCouponId: campaignData.stripeCouponId,
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to create coupon")
    }

    const { couponCode } = await response.json()

    // ユーザードキュメントにクーポン情報を保存
    await setDoc(
      doc(db, "users", userId),
      {
        coupon: {
          code: couponCode,
          percentOff: campaignData.percentOff,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
          used: false,
        },
      },
      { merge: true },
    )

    return couponCode
  } catch (error) {
    // console.error("Error creating coupon:", error)
    if (error instanceof FirebaseError) {
      // console.error("Firebase error code:", error.code)
      // console.error("Firebase error message:", error.message)
    }
    throw error
  }
}

