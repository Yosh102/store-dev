import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 環境変数からPayPayの有効化状態を取得
    const isPayPayEnabled = process.env.ENABLE_PAYPAY === 'true'
    
    return NextResponse.json({
      enabled: isPayPayEnabled,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('PayPay config fetch error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch PayPay configuration',
        enabled: false // エラー時はfalseを返す
      },
      { status: 500 }
    )
  }
}