// src/app/(protected)/order/jamm/success/page.tsx
import Link from 'next/link'
import { CheckCircle, ArrowLeft } from 'lucide-react'

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function JammSuccessPage({ searchParams }: any) {
  // Next.js 15 では searchParams が Promise の可能性もあるので両対応
  let resolved: SearchParams = {}

  if (searchParams) {
    if (typeof (searchParams as any).then === 'function') {
      // Promise の場合
      resolved = (await searchParams) as SearchParams
    } else {
      // ただのオブジェクトの場合
      resolved = searchParams as SearchParams
    }
  }

  const chargeIdParam = resolved.chargeId
  const mockParam = resolved.mock

  const chargeId = Array.isArray(chargeIdParam)
    ? chargeIdParam[0]
    : chargeIdParam

  const mockRaw = Array.isArray(mockParam) ? mockParam[0] : mockParam
  const isMock = mockRaw === '1' || mockRaw === 'true'

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* アイコン */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>

        {/* メインメッセージ */}
        <h1 className="text-2xl md:text-3xl font-semibold mb-3">
          ご注文ありがとうございます
        </h1>
        <p className="text-sm md:text-base text-gray-600 mb-4">
          Jamm（口座振替あと払い）でのご注文を受け付けました。
        </p>

        {/* 決済ID（あれば） */}
        {chargeId && (
          <p className="text-xs text-gray-500 mb-4">
            決済ID:{' '}
            <span className="font-mono">
              {chargeId}
            </span>
          </p>
        )}

        {/* モック環境用の注意書き */}
        {isMock && (
          <p className="text-xs md:text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-6">
            ※ 現在は <span className="font-semibold">テスト用モック</span> で動作しています。
            <br />
            実際のJamm決済は行われていません。
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
