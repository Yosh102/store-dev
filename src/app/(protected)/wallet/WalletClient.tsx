// src/app/(protected)/wallet/WalletClient.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/auth-context'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWallet, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import WalletComponent from '@/components/store/wallet/WalletComponent'
import { getAuth } from 'firebase/auth';

const VERIFICATION_TTL_MS = 30 * 60 * 1000 // 30分

// --- IDトークン取得（厳密） ---
const getIdTokenStrict = async (): Promise<string> => {
  const auth = getAuth();
  const u = auth.currentUser;
  if (!u) throw new Error('not signed in');
  const t = await u.getIdToken(true); // ★最新のIDトークンを取得
  if (!t) throw new Error('failed to get ID token');
  return t;
};

// --- セッションIDを確実に用意 ---
const ensureSessionId = () => {
  try {
    const key = 'walletSessionId'
    let sid = localStorage.getItem(key)
    if (!sid) {
      sid = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))
      localStorage.setItem(key, sid)
    }
    return sid
  } catch {
    // localStorage 使えない環境向けフォールバック
    return Math.random().toString(36).slice(2)
  }
}

export default function WalletClient() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const sessionIdRef = useRef<string>('')   // ★ セッションID保持
  const [sessionReady, setSessionReady] = useState(false) // ★ ボタン制御用

  // 認証フロー
  const [step, setStep] = useState<'sending' | 'input' | 'wallet' | 'verifying'>('sending')
  const [code, setCode] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // 既に認証済み && 30分以内ならスキップ
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ts = localStorage.getItem('walletVerifiedAt')
    if (ts) {
      const last = Number(ts)
      if (!Number.isNaN(last) && Date.now() - last < VERIFICATION_TTL_MS) {
        setStep('wallet')
        return
      }
    }
    // 認証期限切れ → 初期は send ボタン表示
    setStep('sending')
  }, [])

  // セッションID初期化（マウント時）
  useEffect(() => {
    const sid = ensureSessionId()
    sessionIdRef.current = sid
    setSessionReady(!!sid)
  }, [])

  // 未ログインならリダイレクト（副作用のみ）
  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  // 再送クールダウン
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // 画面復帰時に30分超過なら再認証を促す
  useEffect(() => {
    const handler = () => {
      const ts = localStorage.getItem('walletVerifiedAt')
      if (!ts) return
      const last = Number(ts)
      if (Number.isNaN(last)) return
      if (Date.now() - last >= VERIFICATION_TTL_MS) {
        setStep('sending')
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // --- 認証コード送信 ---
  const sendCode = async () => {
    if (cooldown > 0) return
    setError(null)
    try {
      if (!user) throw new Error('not signed in')
      setStep('sending')

      // ★ 送信直前の二重ガード
      if (!sessionIdRef.current) {
        sessionIdRef.current = ensureSessionId()
        setSessionReady(!!sessionIdRef.current)
      }

      const idToken = await getIdTokenStrict()
      const payload = {
        sessionId: sessionIdRef.current,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : ''
      }

      const res = await fetch('/api/log/wallet/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-session-id': sessionIdRef.current,           // ★ ヘッダにも同梱
        },
        body: JSON.stringify(payload),
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok === false) {
        let msg = 'メールの送信に失敗しました。'
        if (j?.reason === 'unauthorized') msg = '権限がありません。ログインし直してください。'
        else if (j?.reason === 'bad_request') msg = 'リクエストが不正です（sessionId など不足）。'
        else if (j?.reason === 'cooldown') msg = '送信間隔の制限中です。少し待って再試行してください。'
        else if (j?.reason === 'no_email') msg = '送信先メールが見つかりません。'
        throw new Error(msg)
      }

      setStep('input')
      setCooldown(60)
      setTimeout(() => inputsRef.current[0]?.focus(), 0)
    } catch (e:any) {
      console.error(e)
      setError(e?.message || 'メールの送信に失敗しました。少し待って再試行してください。')
      setStep('sending')
    }
  }

  // --- 認証コード検証 ---
  const verifyCode = async () => {
    setError(null)
    const joined = code.join('').toUpperCase()
    if (joined.length !== 6) {
      setError('6桁すべて入力してください。')
      return
    }
    try {
      if (!user) throw new Error('not signed in')
      setStep('verifying')

      // ★ 念のため二重ガード
      if (!sessionIdRef.current) {
        sessionIdRef.current = ensureSessionId()
        setSessionReady(!!sessionIdRef.current)
      }

      const idToken = await getIdTokenStrict()
      const res = await fetch('/api/log/wallet/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          'x-session-id': sessionIdRef.current,         // ★ 同梱
        },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          code: joined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(
          data?.reason === 'expired' ? 'コードの有効期限が切れました。'
          : data?.reason === 'invalid_token' ? '認証に失敗しました。ログインし直してください。'
          : (data?.error || 'コードが正しくありません。')
        )
        setStep('input')
        return
      }

      localStorage.setItem('walletVerifiedAt', String(Date.now()))
      setStep('wallet')
    } catch (e:any) {
      console.error(e)
      setError(e?.message || '認証に失敗しました。')
      setStep('input')
    }
  }

  // --- 1文字入力（大文字英数字のみ） ---
  const handleChange = (value: string, index: number) => {
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!char) return
    const next = [...code]
    next[index] = char
    setCode(next)
    if (index < 5) inputsRef.current[index + 1]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = [...code]
      if (next[index]) {
        next[index] = ''
        setCode(next)
      } else if (index > 0) {
        next[index - 1] = ''
        setCode(next)
        inputsRef.current[index - 1]?.focus()
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (pasted.length !== 6) return
    setCode(pasted.split('').slice(0, 6))
    inputsRef.current[5]?.focus()
  }

  // Auth 未確定時は UI を出さない（早押し事故防止）
  if (loading || !user) return <div>Loading...</div>

  return (
    <div className="container mx-auto px-2 py-8">
      <h1 className="text-2xl font-bold mb-6">ウォレット</h1>

      {step === 'wallet' ? (
        <Card>
          <CardContent className="space-y-6">
            <div className="flex items-center">
              <FontAwesomeIcon icon={faWallet} className="mr-2 text-xl" />
              <h2 className="text-xl font-semibold">決済方法</h2>
            </div>
            <p className="text-sm text-gray-600">登録済みの決済方法を管理します</p>
            <WalletComponent />
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-lg mx-auto">
          <CardContent className="p-4 space-y-6">
            {step === 'sending' && (
              <>
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faEnvelope} className="mr-2 text-xl" />
                  <h2 className="text-xl font-semibold">本人確認が必要です</h2>
                </div>
                <p className="text-sm text-gray-700">
                  ウォレット情報を表示するために、登録メールアドレス（{user.email}）へ認証コードを送信します。
                </p>
                <Button
                  onClick={sendCode}
                  disabled={cooldown > 0 || !sessionReady || loading || !user}
                >
                  {cooldown > 0 ? `再送信まで ${cooldown}s` : 'コードを送信'}
                </Button>
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              </>
            )}

            {step === 'input' && (
              <>
                <h2 className="text-lg font-semibold">認証コードの入力</h2>
                <p className="text-sm text-gray-700">メールに記載された6桁の英数字コードを入力してください（自動で大文字化）。</p>

                <div
                  onPaste={handlePaste}
                  className="grid grid-cols-6 gap-2 sm:gap-3 mt-4 mb-2"
                >
                  {code.map((v, i) => (
                    <Input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el }}
                      value={v}
                      onChange={(e) => handleChange(e.target.value, i)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      maxLength={1}
                      className="h-12 sm:h-14 text-center text-lg sm:text-xl font-mono uppercase px-0 text-gray-900 bg-white border border-gray-300 focus:border-black focus:ring-black"
                      inputMode="text"
                      autoComplete="one-time-code"
                    />
                  ))}
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex gap-3">
                  <Button onClick={verifyCode} className="flex-1">認証する</Button>
                  <Button
                    onClick={sendCode}
                    variant="outline"
                    disabled={cooldown > 0 || !sessionReady || loading || !user}
                    className="flex-1"
                  >
                    {cooldown > 0 ? `再送信(${cooldown})` : 'コード再送'}
                  </Button>
                </div>
              </>
            )}

            {step === 'verifying' && <p className="text-gray-800">認証中です...</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
