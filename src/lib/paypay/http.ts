import crypto from 'crypto'

/** 環境ベースURL */
const BASE_URL =
  (process.env.PAYPAY_ENVIRONMENT || 'sandbox') === 'production'
    ? 'https://api.paypay.ne.jp'
    : 'https://stg-api.sandbox.paypay.ne.jp'

type Method = 'GET' | 'POST' | 'DELETE'

/** MD5(content-type + body) → base64
 *  GET/DELETE 等で body が無い時は "empty"
 *  content-type も同様に "empty"
 */
function md5Base64(contentType: string | null, body: string | null): string {
  if (!body || !contentType) return 'empty'
  const md = crypto.createHash('md5')
  md.update(Buffer.from(contentType, 'utf8'))
  md.update(Buffer.from(body, 'utf8'))
  return md.digest('base64')
}

/** OPA-Auth 署名文字列を作成（改行区切り）
 *  requestUrl(=path)
 *  httpMethod
 *  nonce
 *  epoch
 *  contentType or "empty"
 *  hash (Step1) or "empty"
 */
function buildStringToSign(opts: {
  path: string
  method: Method
  nonce: string
  epoch: number
  contentType: string | null
  hash: string
}) {
  const ct = opts.contentType ?? 'empty'
  const h = opts.hash ?? 'empty'
  return [
    opts.path,         // Request URI (例: "/v2/codes")
    opts.method,       // HTTPメソッド
    opts.nonce,        // ランダム文字列
    String(opts.epoch),// エポック秒（±120秒以内）
    ct,
    h,
  ].join('\n')
}

/** HMAC-SHA256 → base64 */
function hmacSha256Base64(secret: string, data: string) {
  return crypto.createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(Buffer.from(data, 'utf8'))
    .digest('base64')
}

/** PayPay OPA リクエスト（ドキュメント準拠の OPA-Auth 方式） */
export async function paypayRequest<T>({
  method,
  path,
  json,
  assumeMerchant = process.env.PAYPAY_MERCHANT_ID,
  // デバッグ出力を有効化したい場合は環境変数で切り替え
  debug = process.env.PAYPAY_DEBUG === 'true',
}: {
  method: Method
  path: string
  json?: unknown
  assumeMerchant?: string | null
  debug?: boolean
}): Promise<T> {
  const apiKey = process.env.PAYPAY_API_KEY!
  const apiSecret = process.env.PAYPAY_API_SECRET!
  if (!apiKey || !apiSecret) throw new Error('PayPay API key/secret is not set')

  // body / content-type の決定（OPA-Auth では両方を署名に使う）
  const hasBody = method === 'POST'
  const url = `${BASE_URL}${path}`
  const epoch = Math.floor(Date.now() / 1000)
  const nonce = crypto.randomBytes(12).toString('hex')

  // 送信と署名で **完全に同じ content-type 文字列** を使うこと！
  // 公式例に合わせて charset を含む（末尾セミコロンは付けない）
  const contentType = hasBody ? 'application/json; charset=UTF-8' : null
  const body = hasBody ? JSON.stringify(json ?? {}) : null

  // Step1: MD5(content-type + body) or "empty"
  const hash = md5Base64(contentType, body)

  // Step2: 署名文字列（改行区切り）
  const toSign = buildStringToSign({
    path,
    method,
    nonce,
    epoch,
    contentType,
    hash,
  })

  // Step3: HMAC-SHA256(base64)
  const macData = hmacSha256Base64(apiSecret, toSign)

  // Step4: Authorization ヘッダー（OPA-Auth 形式）
  // "hmac OPA-Auth:{apiKey}:{macData}:{nonce}:{epoch}:{hash}"
  const authorization = `hmac OPA-Auth:${apiKey}:${macData}:${nonce}:${epoch}:${hash}`

  const headers: Record<string, string> = {
    Authorization: authorization,
  }
  if (contentType) headers['Content-Type'] = contentType
  if (assumeMerchant) headers['X-ASSUME-MERCHANT'] = assumeMerchant

  if (debug) {
    // 署名に使った素材を全部出す（本番では無効に）
    console.log('[PayPay DEBUG][OPA-Auth] method:', method)
    console.log('[PayPay DEBUG][OPA-Auth] path:', path)
    console.log('[PayPay DEBUG][OPA-Auth] epoch:', epoch)
    console.log('[PayPay DEBUG][OPA-Auth] nonce:', nonce)
    console.log('[PayPay DEBUG][OPA-Auth] contentType:', contentType ?? 'empty')
    console.log('[PayPay DEBUG][OPA-Auth] body:', body ?? '')
    console.log('[PayPay DEBUG][OPA-Auth] md5(base64):', hash)
    console.log('[PayPay DEBUG][OPA-Auth] stringToSign:\n' + toSign)
    console.log('[PayPay DEBUG][OPA-Auth] mac(base64):', macData)
    console.log('[PayPay DEBUG][OPA-Auth] URL:', url)
    console.log('[PayPay DEBUG][OPA-Auth] ReqHeaders:', headers)
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ?? undefined,
    cache: 'no-store',
  })

  const text = await res.text().catch(() => '')
  if (debug) {
    console.log('[PayPay DEBUG][OPA-Auth] Status:', res.status)
    console.log('[PayPay DEBUG][OPA-Auth] ResBody:', text)
  }

  if (!res.ok) {
    // 可能なら codeId を抽出してメッセージに載せる
    try {
      const j = text ? JSON.parse(text) : null
      const codeId = j?.resultInfo?.codeId
      throw new Error(
        `PayPay API error ${res.status}: ${text || res.statusText}` +
        (codeId ? ` (codeId:${codeId})` : '')
      )
    } catch {
      throw new Error(`PayPay API error ${res.status}: ${text || res.statusText}`)
    }
  }

  return text ? (JSON.parse(text) as T) : ({} as T)
}

/** デバッグ用途で参照できるように */
export const PAYPAY_BASE_URL = BASE_URL
