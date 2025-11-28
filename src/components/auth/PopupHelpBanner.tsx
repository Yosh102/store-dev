// components/auth/PopupHelpBanner.tsx（新規）
"use client";
export default function PopupHelpBanner() {
  return (
    <div className="mt-4 rounded-lg border border-gray-300 bg-gray-50 p-4 text-gray-900">
      <p className="font-semibold mb-2">ポップアップがブロックされている可能性があります。</p>
      <ul className="list-disc list-inside text-sm space-y-1">
        <li>ブラウザの設定で「ポップアップを許可」をオンにしてください。</li>
        <li>iOSでは「設定 → Safari → ポップアップブロックをオフ」にすると許可できます。</li>
      </ul>
      <div className="mt-2 text-sm underline">
        <a href="https://support.apple.com/ja-jp/102524" target="_blank" rel="noreferrer">iPhone/iPad での許可方法（Apple公式）</a><br/>
        <a href="https://support.google.com/chrome/answer/95472?hl=ja&co=GENIE.Platform%3DAndroid" target="_blank" rel="noreferrer">Chrome の許可方法（Google公式）</a>
      </div>
    </div>
  )
}
