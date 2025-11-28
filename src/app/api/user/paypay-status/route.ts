// app/api/user/paypay-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      )
    }

    // Firestoreからユーザー情報を取得
    const userDoc = await getDoc(doc(db, 'users', userId))
    
    if (!userDoc.exists()) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    
    return NextResponse.json({
      success: true,
      payPayAuthorization: userData.payPayAuthorization || null
    })

  } catch (error) {
    console.error('PayPay status fetch error:', error)
    return NextResponse.json(
      { error: 'PayPay認可状況の取得に失敗しました' },
      { status: 500 }
    )
  }
}