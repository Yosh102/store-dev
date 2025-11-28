// src/app/(protected)/order/jamm/failure/page.tsx
interface Props {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function JammFailurePage({ searchParams }: Props) {
  const reason = (searchParams.reason as string) ?? ''

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-6 space-y-4">
        <h1 className="text-2xl font-bold text-center mb-2">
          決済に失敗しました
        </h1>

        <p className="text-sm text-gray-700">
          Jammでの決済処理が完了しませんでした。
          時間をおいて再度お試しいただくか、別のお支払い方法をご利用ください。
        </p>

        {reason && (
          <p className="text-xs text-gray-500">
            エラー理由: <span className="font-mono">{reason}</span>
          </p>
        )}

        <div className="mt-4 flex flex-col space-y-3">
          <a
            href="/checkout"
            className="inline-flex items-center justify-center h-10 rounded-md bg-black text-white text-sm font-medium hover:bg-gray-800"
          >
            チェックアウトに戻る
          </a>
          <a
            href="/store"
            className="inline-flex items-center justify-center h-10 rounded-md border border-gray-300 text-sm font-medium hover:bg-gray-50"
          >
            ストアトップへ
          </a>
        </div>
      </div>
    </main>
  )
}