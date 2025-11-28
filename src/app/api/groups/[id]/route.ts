// src/app/api/groups/[id]/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next.js 15: params は Promise なので await が必要
    const { id: groupId } = await params

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      )
    }

    // Firestoreからグループ情報を取得
    const groupRef = doc(db, "groups", groupId)
    const groupSnap = await getDoc(groupRef)

    if (!groupSnap.exists()) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      )
    }

    const groupData = {
      id: groupSnap.id,
      ...groupSnap.data()
    }

    return NextResponse.json(
      { group: groupData },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching group:", error)
    return NextResponse.json(
      { error: "Failed to fetch group" },
      { status: 500 }
    )
  }
}