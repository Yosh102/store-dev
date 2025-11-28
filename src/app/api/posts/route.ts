// app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore"
import { getAuth } from "firebase-admin/auth"
import { adminDb } from "@/lib/firebase-admin"
import type { Group } from "@/types/group"
import type { Post } from "@/types/post"

// 記事が公開されているかチェック
function isPostPublished(post: any): boolean {
  if (post.status !== "published") return false
  const now = new Date()
  const publishDate = post.publishDate.toDate()
  return publishDate <= now
}

// ユーザーが記事を閲覧できるかチェック
async function canUserViewPost(post: any, userId?: string): Promise<boolean> {
  // 公開記事は誰でも閲覧可能
  if (!post.membersOnly) return true
  
  // 未ログインユーザーは閲覧不可
  if (!userId) return false
  
  // ユーザー情報を取得
  const userDoc = await adminDb.collection("users").doc(userId).get()
  if (!userDoc.exists) return false
  
  const userData = userDoc.data()
  
  // 管理者・アーティストは全て閲覧可能
  if (userData?.role === "admin" || userData?.role === "artist") return true
  
  // グループのサブスクリプションをチェック
  if (post.groups && Array.isArray(post.groups)) {
    for (const groupId of post.groups) {
      if (userData?.subscriptions?.[groupId]?.status === "active") {
        return true
      }
    }
  }
  
  return false
}

// ✅ コンテンツを100文字にサニタイズ（/api/posts/[id]と同じロジック）
function sanitizePreviewContent(content: string): string {
  return content
    .replace(/!\[.*?\]\(.*?\)/g, "") // 画像を削除
    .replace(/_{2,}/g, "") // アンダースコアを削除
    .replace(/𓐄/g, "") // 特殊文字を削除
    .replace(/[#*`]/g, "") // マークダウン記号を削除
    .trim()
    .slice(0, 100) + "..."
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryType = searchParams.get("type") // "list", "carousel"
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")
    const limitParam = searchParams.get("limit")
    const page = searchParams.get("page")
    
    // 認証トークンを取得
    const token = request.headers.get("authorization")?.split("Bearer ")[1]
    let userId: string | undefined
    let userRole: string | undefined
    
    if (token) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token)
        userId = decodedToken.uid
        
        // ユーザーのロールを取得
        const userDoc = await adminDb.collection("users").doc(userId).get()
        if (userDoc.exists) {
          userRole = userDoc.data()?.role
        }
      } catch (error) {
        console.error("Token verification failed:", error)
      }
    }
    
    const now = Timestamp.now()
    const constraints: QueryConstraint[] = []
    
    // 管理者以外は公開済み記事のみ表示
    if (userRole !== "admin" && userRole !== "artist") {
      constraints.push(
        where("status", "==", "published"),
        where("publishDate", "<=", now)
      )
    }
    
    // クエリタイプ別の処理
    if (queryType === "carousel") {
      // カルーセル用: pickup タグでフィルタ
      const carouselTag = tag || "pickup"
      constraints.push(where("tags", "array-contains", carouselTag))
      
      if (category) {
        constraints.push(where("categories", "array-contains", category))
      }
      
      constraints.push(orderBy("publishDate", "desc"))
      constraints.push(limit(parseInt(limitParam || "5")))
      
    } else {
      // 通常の一覧
      constraints.push(orderBy("publishDate", "desc"))
      
      if (limitParam) {
        constraints.push(limit(parseInt(limitParam)))
      }
    }
    
    const q = query(collection(db, "posts"), ...constraints)
    const snapshot = await getDocs(q)
    
    const posts = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data()
        const post: Post = { id: doc.id, ...data } as Post
        
        // 閲覧権限チェック
        const canView = await canUserViewPost(post, userId)
        
        // グループ情報を取得
        let groupData: { name: string; slug: string } | null = null
        if (post.groups && post.groups.length > 0) {
          const groupDoc = await adminDb.collection("groups").doc(post.groups[0]).get()
          if (groupDoc.exists) {
            const group = groupDoc.data() as Group
            groupData = {
              name: group.name,
              slug: group.slug,
            }
          }
        }
        
        // ✅ contentの処理
        let displayContent = post.content || ""
        
        // メンバーシップ限定記事で閲覧権限がない場合は、100文字のプレビューに変換
        if (post.membersOnly && !canView) {
          displayContent = sanitizePreviewContent(displayContent)
        }
        
        return {
          id: post.id,
          title: post.title,
          content: displayContent, // ✅ サニタイズされたコンテンツ
          excerpt: post.excerpt,
          thumbnailUrl: post.thumbnailUrl,
          publishDate: post.publishDate.toDate().toISOString(),
          status: post.status,
          membersOnly: post.membersOnly,
          categories: post.categories || [],
          tags: post.tags || [],
          groups: post.groups || [],
          groupName: groupData?.name || "",
          groupSlug: groupData?.slug || "",
          canView,
          isPublished: isPostPublished(post),
          // カルーセル用の追加フィールド
          pickup_thumb: post.pickup_thumb,
          pickup_thumb_pc: post.pickup_thumb_pc,
          pickup_title_color: post.pickup_title_color,
          pickup_subtitle: post.pickup_subtitle,
          pickup_color: post.pickup_color,
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      posts,
      total: snapshot.size,
    })
    
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch posts" },
      { status: 500 }
    )
  }
}