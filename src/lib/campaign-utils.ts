import { db } from "./firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"

export async function initializeCampaign() {
  const campaignRef = doc(db, "campaigns", "current")
  const campaignDoc = await getDoc(campaignRef)

  if (!campaignDoc.exists()) {
    // Call the API to initialize the campaign
    const response = await fetch("/api/initialize-campaign", {
      method: "POST",
    })

    if (!response.ok) {
      throw new Error("Failed to initialize campaign")
    }

    const { stripeCouponId, percentOff } = await response.json()

    // Save the campaign data to Firestore
    await setDoc(campaignRef, {
      stripeCouponId,
      percentOff,
      startDate: new Date(),
      endDate: new Date("2024-12-31T23:59:59"),
    })

    // console.log("Campaign initialized with coupon:", stripeCouponId)
  } else {
    // console.log("Campaign already exists")
  }
}

// この関数名を ensureDefaultCampaign から initializeCampaign に変更しました
export { initializeCampaign as ensureDefaultCampaign }

