// src/app/(protected)/order/jamm/success/page.tsx
import { redirect } from 'next/navigation'

interface Props {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function JammSuccessPage({ searchParams }: Props) {
  const chargeId = (searchParams.chargeId as string) ?? ''
  const isMock = searchParams.mock === '1' || searchParams.mock === 'true'

  // 必須パラメータが無ければ 404 かトップへ返すのもアリ
  // if (!chargeId) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center mb-2">
          ご注文ありがとうございます
        </h1>

        <p className="text-sm text-gray-700">
          Jamm（口座振替あと払い）でのご注文を受け付けました。
        </p>

        {chargeId && (
          <p className="text-xs text-gray-500">
            決済ID: <span className="font-mono">{chargeId}</span>
          </p>
        )}

        {isMock && (
          <p className="text-xs text-amber-600 border border-amber-200 bg-amber-50 rounded-md px-3 py-2">
            ※ 現在は <strong>テスト用モック</strong> で動作しています。
            実際のJamm決済は行われていません。
          </p>
        )}

        <div className="mt-4 flex flex-col space-y-3">
          <a
            href="/store"
            className="inline-flex items-center justify-center h-10 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800"
          >
            ストアに戻る
          </a>
          <a
            href="/mypage/orders"
            className="inline-flex items-center justify-center h-10 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            注文履歴を確認する
          </a>
        </div>
      </div>
    </main>
  )
}