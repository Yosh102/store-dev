// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
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
async function canUserViewPost(post: any, userId?: string, userRole?: string): Promise<boolean> {
  // 管理者・アーティストは全て閲覧可能
  if (userRole === "admin" || userRole === "artist") return true
  
  // 公開記事は誰でも閲覧可能
  if (!post.membersOnly) return true
  
  // 未ログインユーザーは閲覧不可
  if (!userId) return false
  
  // ユーザー情報を取得
  const userDoc = await adminDb.collection("users").doc(userId).get()
  if (!userDoc.exists) return false
  
  const userData = userDoc.data()
  
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
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
    
    // 記事を取得
    const postDoc = await getDoc(doc(db, "posts", id))
    
    if (!postDoc.exists()) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      )
    }
    
    const postData: Post = { 
      id: postDoc.id, 
      ...postDoc.data() 
    } as Post
    
    // 公開状態チェック
    const published = isPostPublished(postData)
    if (!published && userRole !== "admin" && userRole !== "artist") {
      return NextResponse.json(
        { 
          success: false, 
          error: "Post not published yet",
          publishDate: postData.publishDate.toDate().toISOString()
        },
        { status: 403 }
      )
    }
    
    // 閲覧権限チェック
    const canView = await canUserViewPost(postData, userId, userRole)
    
    // グループ情報を取得
    let groupData: { name: string; slug: string } | null = null
    if (postData.groups && postData.groups.length > 0) {
      const groupDoc = await adminDb.collection("groups").doc(postData.groups[0]).get()
      if (groupDoc.exists) {
        const group = groupDoc.data() as Group
        groupData = {
          name: group.name,
          slug: group.slug,
        }
      }
    }
    
    // コンテンツの統計情報を計算
    const content = postData.content || ""
    const charCount = content.replace(/\s/g, '').length
    const imageCount = (content.match(/!\[.*?\]\(.*?\)/g) || []).length
    
    // 閲覧可能な場合は全データを返す
    if (canView) {
      return NextResponse.json({
        success: true,
        post: {
          id: postData.id,
          title: postData.title,
          content: postData.content,
          thumbnailUrl: postData.thumbnailUrl,
          publishDate: postData.publishDate.toDate().toISOString(),
          status: postData.status,
          membersOnly: postData.membersOnly,
          categories: postData.categories || [],
          tags: postData.tags || [],
          groups: postData.groups || [],
          isOfficialAnnouncement: postData.isOfficialAnnouncement || false,
          groupName: groupData?.name || "",
          groupSlug: groupData?.slug || "",
          canView: true,
          isPublished: published,
          stats: {
            charCount,
            imageCount
          }
        }
      })
    }
    
    // 閲覧不可の場合はプレビューのみ返す
    const sanitizedContent = content
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/_{2,}/g, "")
      .replace(/𓐄/g, "")
      .slice(0, 100) + "..."
    
    return NextResponse.json({
      success: true,
      post: {
        id: postData.id,
        title: postData.title,
        content: sanitizedContent,
        thumbnailUrl: postData.thumbnailUrl,
        publishDate: postData.publishDate.toDate().toISOString(),
        status: postData.status,
        membersOnly: postData.membersOnly,
        categories: postData.categories || [],
        tags: postData.tags || [],
        groups: postData.groups || [],
        groupName: groupData?.name || "",
        groupSlug: groupData?.slug || "",
        canView: false,
        isPublished: published,
        stats: {
          charCount,
          imageCount
        }
      }
    })
    
  } catch (error) {
    console.error("Error fetching post:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch post" },
      { status: 500 }
    )
  }
}