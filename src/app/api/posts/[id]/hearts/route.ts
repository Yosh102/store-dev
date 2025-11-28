// src/app/api/posts/[id]/hearts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

const MAX_HEARTS_PER_USER = 1

async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('unauthorized')
  }
  
  const token = authHeader.slice(7)
  const decoded = await adminAuth.verifyIdToken(token)
  return decoded.uid
}

// GET: ハート情報の取得
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    
    // 認証（オプション - ログインしていなくても総数は見られる）
    let userId: string | null = null
    try {
      userId = await requireAuth(req)
    } catch {
      // 未認証でもOK
    }

    // 投稿の存在確認
    const postRef = adminDb.collection('posts').doc(postId)
    const postSnap = await postRef.get()
    
    if (!postSnap.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const postData = postSnap.data()
    const totalHearts = postData?.stats?.hearts || 0

    // ユーザーのハート数を取得
    let userCount = 0
    if (userId) {
      const userHeartRef = postRef.collection('hearts').doc(userId)
      const userHeartSnap = await userHeartRef.get()
      
      if (userHeartSnap.exists) {
        userCount = userHeartSnap.data()?.count || 0
      }
    }

    return NextResponse.json({
      success: true,
      totalHearts,
      userCount,
      maxHearts: MAX_HEARTS_PER_USER
    })
  } catch (error: any) {
    console.error('Error fetching hearts:', error)
    
    if (error.message === 'unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: ハートを送る
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const userId = await requireAuth(req)

    // 投稿の存在確認とメンバーシップチェック
    const postRef = adminDb.collection('posts').doc(postId)
    const postSnap = await postRef.get()
    
    if (!postSnap.exists) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const postData = postSnap.data()
    
    // メンバーシップ限定記事かチェック
    if (!postData?.membersOnly) {
      return NextResponse.json(
        { error: 'Hearts can only be sent to membership-only posts' },
        { status: 400 }
      )
    }

    // グループメンバーシップの確認
    const groups = postData.groups || []
    if (groups.length > 0) {
      // ユーザー情報を取得してサブスクリプションを確認
      const userRef = adminDb.collection('users').doc(userId)
      const userSnap = await userRef.get()
      
      if (!userSnap.exists) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
      
      const userData = userSnap.data()
      
      // 管理者・アーティストは常にアクセス可能
      if (userData?.role === 'admin' || userData?.role === 'artist') {
        console.log('Admin/Artist access granted for hearts')
        // トランザクション処理にスキップ
      } else {
        // サブスクリプション確認
        let hasAccess = false
        const subscriptions = userData?.subscriptions || {}
        
        for (const groupId of groups) {
          const subscription = subscriptions[groupId]
          
          console.log(`Checking subscription for group ${groupId}:`, subscription)
          
          if (subscription) {
            // アクティブなサブスクリプションかチェック
            const isActive = 
              subscription.status === 'active' || 
              subscription.status === 'trialing' ||
              (subscription.status === 'canceled' && subscription.cancelAtPeriodEnd === false)
            
            if (isActive) {
              hasAccess = true
              console.log(`Access granted via subscription to group ${groupId}`)
              break
            }
          }
        }
        
        if (!hasAccess) {
          console.log('Access denied - no valid membership found')
          return NextResponse.json(
            { error: 'Membership required' },
            { status: 403 }
          )
        }
      }
    }

    // トランザクションでハートを追加
    const result = await adminDb.runTransaction(async (transaction) => {
      const userHeartRef = postRef.collection('hearts').doc(userId)
      const userHeartSnap = await transaction.get(userHeartRef)
      
      const currentCount = userHeartSnap.exists 
        ? (userHeartSnap.data()?.count || 0) 
        : 0
      
      // 上限チェック
      if (currentCount >= MAX_HEARTS_PER_USER) {
        throw new Error('MAX_HEARTS_REACHED')
      }
      
      const newCount = currentCount + 1
      
      // ユーザーのハート数を更新
      if (userHeartSnap.exists) {
        transaction.update(userHeartRef, {
          count: newCount,
          lastUpdated: FieldValue.serverTimestamp()
        })
      } else {
        transaction.set(userHeartRef, {
          userId,
          count: newCount,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp()
        })
      }
      
      // 投稿の総ハート数を更新
      transaction.update(postRef, {
        'stats.hearts': FieldValue.increment(1),
        'stats.heartsCount': userHeartSnap.exists 
          ? FieldValue.increment(0) 
          : FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      })
      
      return { newCount }
    })

    return NextResponse.json({
      success: true,
      count: result.newCount,
      remaining: MAX_HEARTS_PER_USER - result.newCount
    })
  } catch (error: any) {
    console.error('Error sending heart:', error)
    
    if (error.message === 'unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (error.message === 'MAX_HEARTS_REACHED') {
      return NextResponse.json(
        { error: 'Maximum hearts reached' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}