// app/paypay/auth/error/page.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function PayPayAuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const description = searchParams.get('description')

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'access_denied':
        return {
          title: '認可がキャンセルされました',
          description: 'PayPay連携がキャンセルされました。再度お試しください。'
        }
      case 'invalid_request':
        return {
          title: '無効なリクエストです',
          description: 'リクエストに問題があります。もう一度やり直してください。'
        }
      case 'invalid_session':
        return {
          title: 'セッションが無効です',
          description: 'セッションの有効期限が切れています。もう一度やり直してください。'
        }
      case 'session_expired':
        return {
          title: 'セッションが期限切れです',
          description: 'セッションの有効期限が切れました。もう一度やり直してください。'
        }
      case 'auth_process_failed':
        return {
          title: '認証処理に失敗しました',
          description: 'PayPay認証処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。'
        }
      case 'internal_error':
        return {
          title: 'システムエラーが発生しました',
          description: 'システム側でエラーが発生しました。しばらく時間をおいて再度お試しください。'
        }
      default:
        return {
          title: 'PayPay連携に失敗しました',
          description: description || 'PayPay連携中にエラーが発生しました。もう一度お試しください。'
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  useEffect(() => {
    // 10秒後に自動でウィンドウを閉じる
    const timer = setTimeout(() => {
      if (window.opener) {
        window.close()
      }
    }, 10000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2 text-red-900">
            {errorInfo.title}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {errorInfo.description}
          </p>

          {error && (
            <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-100 rounded">
              エラーコード: {error}
            </div>
          )}

          <div className="space-y-2">
            <Button 
              onClick={() => window.close()}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              ウィンドウを閉じる
            </Button>
            <p className="text-xs text-gray-500">
              このウィンドウは10秒後に自動的に閉じられます
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}