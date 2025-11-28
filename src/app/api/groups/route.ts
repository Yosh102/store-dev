import { NextResponse } from "next/server"
import { db } from "@/lib/firebase" // 既存の Firestore 初期化
import { collection, getDocs, query, where } from "firebase/firestore"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get("ids")

    // ids が指定されたら、その ID 群のみ返す
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean)
      if (ids.length === 0) {
        return NextResponse.json({ groups: [] }, { status: 200 })
      }

      // Firestore "in" は最大10件 → 分割して結合
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

      const results: any[] = []
      for (const c of chunks) {
        const qRef = query(collection(db, "groups"), where("__name__", "in", c))
        const snap = await getDocs(qRef)
        snap.forEach((doc) => results.push({ id: doc.id, ...doc.data() }))
      }

      return NextResponse.json({ groups: results }, { status: 200 })
    }

    // 指定なしなら全件（必要なら limit/ソートを追加）
    const groupsRef = collection(db, "groups")
    const groupsSnap = await getDocs(groupsRef)
    const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    return NextResponse.json({ groups }, { status: 200 })
  } catch (error) {
    console.error("Error fetching groups:", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}
