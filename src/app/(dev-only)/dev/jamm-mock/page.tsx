// src/app/(dev-only)/dev/jamm-mock/page.tsx
'use client'

import { useState } from 'react'

export default function JammMockConsole() {
  const [chargeId, setChargeId] = useState('')
  const [result, setResult] = useState('')

  const sendMock = async (status: 'success' | 'fail') => {
    const id = chargeId.trim()

    if (!id) {
      setResult('⚠️ chargeId を入力してください')
      return
    }

    try {
      const res = await fetch('/api/jamm/mock-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chargeId: id,
          status,
        }),
      })

      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (e: any) {
      setResult(`エラー: ${e.message}`)
    }
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 12 }}>
        🧪 Jamm モックコンソール（dev only）
      </h1>

      <p>Jamm の Success / Failure を手動で再現するためのツールです。</p>
      <p style={{ marginBottom: 24, color: '#666' }}>
        ※ モックなので本物の Jamm API は一切呼びません。
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontWeight: 'bold' }}>
          Charge ID（例：trx_mock_1764245092989）
        </label>
        <input
          type="text"
          value={chargeId}
          onChange={(e) => setChargeId(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '8px 12px',
            marginTop: 6,
            border: '1px solid #ccc',
            borderRadius: 6,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <button
          onClick={() => sendMock('success')}
          style={{
            background: '#0c0',
            color: 'white',
            padding: '10px 16px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ✔️ 支払い成功にする
        </button>

        <button
          onClick={() => sendMock('fail')}
          style={{
            background: '#c00',
            color: 'white',
            padding: '10px 16px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          ❌ 支払い失敗にする
        </button>
      </div>

      {result && (
        <pre
          style={{
            marginTop: 24,
            background: '#f6f6f6',
            padding: 16,
            borderRadius: 6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {result}
        </pre>
      )}
    </div>
  )
}