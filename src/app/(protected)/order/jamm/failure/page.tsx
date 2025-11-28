// src/app/(protected)/order/jamm/failure/page.tsx
import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function JammFailurePage({ searchParams }: any) {
  // Next.js 15 では searchParams が Promise で来ることがあるので両対応にする
  let resolved: SearchParams = {}

  if (searchParams) {
    if (typeof searchParams.then === 'function') {
      // Promise の場合
      resolved = (await searchParams) as SearchParams
    } else {
      // ただのオブジェクトの場合
      resolved = searchParams as SearchParams
    }
  }

  const chargeIdParam = resolved.chargeId
  const chargeId = Array.isArray(chargeIdParam)
    ? chargeIdParam[0]
    : chargeIdParam

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* アイコン */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>

        {/* メインメッセージ */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-3">
          決済に失敗しました
        </h1>
        <p className="text-sm md:text-base text-gray-600 mb-4">
          Jamm（口座振替あと払い）での決済が完了しませんでした。
        </p>

        {/* 決済ID（あれば） */}
        {chargeId && (
          <p className="text-xs text-gray-500 mb-6">
            決済ID: <span className="font-mono">{chargeId}</span>
          </p>
        )}

        {/* ボタン */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/store"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            ストアに戻る
          </Link>
          <Link
            href="/mypage/orders"
            className="inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm hover:bg-gray-900"
          >
            注文履歴を確認する
          </Link>
        </div>
      </div>
    </div>
  )
}