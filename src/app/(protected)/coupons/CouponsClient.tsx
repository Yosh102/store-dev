"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

interface Coupon {
  id: string
  code: string
  percentOff: number
  expiresAt: Date
  used: boolean
}

export default function CouponsClient() {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState<Coupon[]>([])

  useEffect(() => {
    const fetchUserCoupons = async () => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        const userData = userDoc.data()
        if (userData?.coupon) {
          setCoupons([userData.coupon])
        }
      }
    }

    fetchUserCoupons()
  }, [user])

  if (!user) {
    return <div className="container mx-auto p-4">Please log in to view your coupons.</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Coupons</h1>
      {coupons.length > 0 ? (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <div key={coupon.id} className="bg-white shadow rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">{coupon.code}</h2>
              <p className="text-gray-600">Discount: {coupon.percentOff}% off</p>
              <p className="text-gray-600">Expires: {new Date(coupon.expiresAt).toLocaleDateString()}</p>
              <p className="text-gray-600">Status: {coupon.used ? "Used" : "Available"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p>You don't have any active coupons.</p>
      )}
    </div>
  )
}

