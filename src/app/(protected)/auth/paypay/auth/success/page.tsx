// app/paypay/auth/success/page.tsx
'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function PayPayAuthSuccessPage() {
  const searchParams = useSearchParams()
  const userAuthorizationId = searchParams.get('userAuthorizationId')

  useEffect(() => {
    // 3秒後に自動でウィンドウを閉じる
    const timer = setTimeout(() => {
      if (window.opener) {
        window.close()
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2 text-green-900">
            PayPay連携完了
          </h1>
          
          <p className="text-gray-600 mb-6">
            PayPayアカウントとの連携が正常に完了しました。
            このウィンドウは自動的に閉じられます。
          </p>

          {userAuthorizationId && (
            <div className="text-xs text-gray-500 mb-4">
              認可ID: {userAuthorizationId.substring(0, 8)}...
            </div>
          )}

          <Button 
            onClick={() => window.close()}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            ウィンドウを閉じる
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}