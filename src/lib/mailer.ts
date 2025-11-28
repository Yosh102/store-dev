// /lib/mailer.ts（最終版・本番用）
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import fetch from 'node-fetch'

const ses = new SESClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

function isProd() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_APP_ENV === 'production'
  )
}

// "表示名 <email@domain>" を安全に生成（日本語名はRFC 2047でエンコード）
function formatFrom(displayName: string, email: string) {
  const needsEncoding = /[^\x20-\x7E]/.test(displayName) || /[",]/.test(displayName)
  const safeName = needsEncoding
    ? `=?UTF-8?B?${Buffer.from(displayName, 'utf8').toString('base64')}?=`
    : displayName
  return `${safeName} <${email}>`
}

// IP → 地域変換（例: "日本・東京都千代田区"）
async function resolveLocation(ip?: string): Promise<string> {
  try {
    if (!ip) return '不明'
    // ローカル / プライベートIP は除外
    if (/^(127\.|10\.|192\.168|172\.(1[6-9]|2\d|3[0-1]))/.test(ip)) {
      return 'ローカル接続'
    }

    const res = await fetch(`https://ipapi.co/${ip}/json/`)
    if (!res.ok) return '不明'

    const data = (await res.json()) as any

    const country = data.country_name || data.country || '不明な国'
    const region =
      data.region ||
      data.region_name ||
      data.region_code ||
      data.state ||
      ''
    const city = data.city || data.district || ''

    const area = city
      ? `${country}・${region}${city.length > 2 ? city.slice(0, 3) : city}`
      : `${country}・${region}`

    return area && area.trim() !== '・' ? area : '不明'
  } catch {
    return '不明'
  }
}

/** "Name <email@domain>" / "email@domain" のどちらでも email を抽出 */
function extractEmail(input?: string | null): string | null {
  if (!input) return null
  const m = input.match(/<([^>]+)>/)
  const email = (m ? m[1] : input).trim()
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
}

/** 宛先の解決：開発環境では固定先に差し替え */
function resolveRecipients(to: string) {
  if (isProd()) return { toList: [to], noteHtml: '' }
  const devTo = process.env.DEV_MAIL_TO || 'yoshida@paradigmai.co.jp'
  return {
    toList: [devTo],
    noteHtml: `<hr style="margin:16px 0;border:none;border-top:1px solid #eee"/>
               <p style="color:#888;font-size:12px">
                 DEV強制宛先: ${devTo}<br/>本来の宛先: ${to}
               </p>`,
  }
}
export async function sendOrderConfirmationEmail(params: {
  to: string
  userName?: string
  orderId?: string
  totalJPY: number
  paymentType: 'card' | 'bank_transfer' | 'paypay' | 'paidy'
  address?: { name?: string; prefecture?: string; city?: string; line1?: string }
  items?: Array<{ name: string; quantity: number; price: number }>
  shippingFeeJPY?: number
  paidAt?: Date               // 確定しているときだけ渡す（カード・PayPay・入金済み振込）
  bankInstructionsUrl?: string // 銀行振込の案内URL（未入金時に渡す）
}) {
  const {
    to, userName, orderId, totalJPY, paymentType,
    address, items = [], shippingFeeJPY = 0, paidAt,
    bankInstructionsUrl,
  } = params

  // 宛先解決（本番以外は強制置換）
  const { toList, noteHtml } = resolveRecipients(to)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const isConfirmed = !!paidAt
  const jstPaid = paidAt
    ? new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(paidAt)
    : null

  // 件名を「確定」/「受付（案内）」で自動出し分け
  const subject =
      paymentType === 'bank_transfer'
        ? (isConfirmed
            ? 'ご注文が確定しました（ご入金を確認しました）'
            : 'ご注文を受け付けました（お支払いのご案内）')
        : paymentType === 'paidy'
        ? (isConfirmed
            ? 'ご注文が確定しました（お支払いを確認しました）'
            : 'ご注文を受け付けました（あと払い）')
        : (isConfirmed
            ? 'ご注文が確定しました'
            : 'ご注文を受け付けました')


  // リード文（冒頭文）を自動出し分け
  const lead =
    paymentType === 'bank_transfer'
      ? (isConfirmed
          ? `${userName ?? 'ユーザー'} さん、入金を確認しました。ご注文が確定しましたので、発送準備に入ります。`
          : `${userName ?? 'ユーザー'} さん、ご注文を受け付けました。ご入金の確認ができ次第、発送の処理を進めます。`)
      : paymentType === 'paidy'
      ? (isConfirmed
          ? `${userName ?? 'ユーザー'} さん、お支払いを確認しました。ご注文が確定しましたので、発送準備に入ります。`
          : `${userName ?? 'ユーザー'} さん、ご注文を受け付けました。Paidyによるお支払いが確認でき次第、発送の処理を進めます。`)
      : (isConfirmed
          ? `${userName ?? 'ユーザー'} さん、この度はご購入ありがとうございます。ご注文が確定しましたので、発送準備に入ります。`
          : `${userName ?? 'ユーザー'} さん、ご注文を受け付けました。決済が確定次第、発送の処理を進めます。`)


  const lineItemsHtml =
    items.length === 0
      ? ''
      : `
      <table style="border-collapse:collapse;margin-top:12px;font-size:14px;width:100%;">
        <thead>
          <tr>
            <th align="left" style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;">商品</th>
            <th align="right" style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;">数量</th>
            <th align="right" style="padding:6px 8px;border-bottom:1px solid #eee;color:#555;">金額</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr>
              <td style="padding:6px 8px;">${it.name}</td>
              <td align="right" style="padding:6px 8px;">${it.quantity}</td>
              <td align="right" style="padding:6px 8px;">¥${(it.price * it.quantity).toLocaleString()}</td>
            </tr>
          `).join('')}
          ${shippingFeeJPY > 0 ? `
            <tr>
              <td style="padding:6px 8px;color:#555;">送料</td>
              <td></td>
              <td align="right" style="padding:6px 8px;">¥${shippingFeeJPY.toLocaleString()}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="padding:6px 8px;border-top:1px solid #eee;font-weight:600;">合計</td>
            <td></td>
            <td align="right" style="padding:6px 8px;border-top:1px solid #eee;font-weight:600;">¥${totalJPY.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>`

  const addressHtml = address
    ? `
      <p style="margin-top:12px;font-size:14px;">
        お届け先：${[address.name, address.prefecture, address.city, address.line1].filter(Boolean).join(' ')}
      </p>`
    : ''

  // 支払い確定時は日時を明記（決済種別問わず）
  const confirmedInfoHtml =
    isConfirmed && jstPaid
      ? `<p style="margin-top:12px;font-size:14px;">決済確定日時：${jstPaid}</p>`
      : ''

  // 銀行振込の案内（未入金時のみ）
  const bankGuideHtml =
    paymentType === 'bank_transfer' && !isConfirmed
      ? `
      <p style="margin-top:12px;font-size:14px;line-height:1.6;">
        お支払い方法：銀行振込<br/>
        ${bankInstructionsUrl ? `振込先と手順はこちら：<a href="${bankInstructionsUrl}" style="color:#3366cc;text-decoration:none;">振込案内ページ</a><br/>` : ''}
        ※期日までにお支払いが確認できない場合、ご注文はキャンセルとなる場合があります。
      </p>`
      : ''

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${lead}</p>

    ${orderId ? `<p style="font-size:14px;color:#555;">注文番号：${orderId}</p>` : ''}

    ${lineItemsHtml}

    ${addressHtml}

    ${confirmedInfoHtml}
    ${bankGuideHtml}

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      万一お心当たりのないご注文の場合は、お手数をおかけしますが、<a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">サポート窓口</a>までご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE ID セキュリティーチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}


/** ウォレット閲覧コード送信（6桁英数字） */
export async function sendWalletAccessCodeEmail(params: {
  to: string
  userName?: string
  code: string            // 例: "A7F3K9"
  requestedAt?: Date      // 表示用（省略可）
  ip?: string             // 表示の粒度用（省略可）
  ua?: string             // 表示の粒度用（省略可）
  ttlMinutes?: number     // 有効期限表記（デフォルト10分）
}) {
  const {
    to,
    userName,
    code,
    requestedAt = new Date(),
    ip,
    ua,
    ttlMinutes = 10,
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const approxLocation = await resolveLocation(ip)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(requestedAt)

  const subject = '認証コードをお送りしました'

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さんのウォレット（決済方法）を表示するための認証コードをお送りしました。</p>

    <p style="margin:12px 0 6px;color:#555">以下のコードをページに入力してください（有効期限：${ttlMinutes}分）</p>

    <div style="
      margin:12px 0;
      display:inline-block;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size:28px;
      letter-spacing:.12em;
      padding:12px 16px;
      border:1px solid #e5e7eb;
      border-radius:8px;
      background:#f9fafb;
      color:#111827;
    ">
      <strong>${code}</strong>
    </div>

    <table style="border-collapse:collapse;margin-top:12px;font-size:13px;color:#555">
      <tr><td style="padding:4px 8px;">リクエスト日時</td><td style="padding:4px 8px;">${jst}</td></tr>
      <tr><td style="padding:4px 8px;">アクセス元</td><td style="padding:4px 8px;">${approxLocation}</td></tr>
      <tr><td style="padding:4px 8px;">端末</td><td style="padding:4px 8px;">${ua ? ua.replace(/</g,'&lt;') : '-'}</td></tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      このメールに心当たりがない場合は、第三者によるアクセスの可能性があります。
      直ちに <a href="https://playtune.jp/change-password" style="color:#3366cc;text-decoration:none;">パスワードを変更</a> し、
      <a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">サポート窓口</a>までご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE ID セキュリティーチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}


export async function sendPasswordChangeEmail(params: {
  to: string
  userName?: string
  changedAt: Date
  ip?: string
  ua?: string
}) {
  const { to, userName, changedAt, ip, ua } = params
  const { toList, noteHtml } = resolveRecipients(to)

  const approxLocation = await resolveLocation(ip)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(changedAt)

  const subject = 'パスワードが変更されました'

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、以下のとおりパスワードの変更が完了しました。</p>

    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;">
      <tr><td style="padding:4px 8px;color:#555">日時</td><td style="padding:4px 8px">${jst}</td></tr>
      <tr><td style="padding:4px 8px;color:#555">操作元</td><td style="padding:4px 8px">${approxLocation}</td></tr>
      <tr><td style="padding:4px 8px;color:#555">端末</td><td style="padding:4px 8px">${ua ? ua.replace(/</g,'&lt;') : '-'}</td></tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      ご本人による操作でない場合は、直ちに
      <a href="https://playtune.jp/change-password" style="color:#3366cc;text-decoration:none;">パスワードを再変更</a>
      のうえ、<a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">サポート窓口</a>までご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE ID セキュリティーチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}
export async function sendLoginAlertEmail(params: {
  to: string
  userName?: string
  loginAt: Date
  ip?: string
  ua?: string
  eventType?: 'login' | 'signup'
}) {
  const { to, userName, loginAt, ip, ua, eventType = 'login' } = params
  const { toList, noteHtml } = resolveRecipients(to)

  const approxLocation = await resolveLocation(ip)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) {
    throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  }
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr) // ← 表示名つきFrom

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(loginAt)

  const subject =
    eventType === 'signup'
      ? '新規登録が完了しました'
      : '新しいログインを検出しました'

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
      <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

      <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、${
      eventType === 'signup'
        ? 'アカウントの登録が完了しました。'
        : '以下のログインが確認されました。'
    }</p>

    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;">
      <tr><td style="padding:4px 8px;color:#555">日時</td><td style="padding:4px 8px">${jst}</td></tr>
      <tr><td style="padding:4px 8px;color:#555">アクセス元</td><td style="padding:4px 8px">${approxLocation}</td></tr>
      <tr><td style="padding:4px 8px;color:#555">端末</td><td style="padding:4px 8px">${ua ? ua.replace(/</g,'&lt;') : '-'}</td></tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      ご本人による操作でない場合は、直ちに
      <a href="https://playtune.jp/change-password" style="color:#3366cc;text-decoration:none;">パスワードを変更</a>
      し、<a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">サポート窓口</a>までご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE ID セキュリティーチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader, // ← 表示名 + アドレスで送信
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO
      ? [process.env.REPLY_TO]
      : ['contact@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}
// /lib/mailer.ts に追加

/** サブスクリプション登録完了メール */
export async function sendSubscriptionConfirmationEmail(params: {
  to: string
  userName?: string
  groupName: string
  planType: 'monthly' | 'yearly'
  amount: number
  nextBillingDate: Date
  subscriptionId: string
}) {
  const {
    to,
    userName,
    groupName,
    planType,
    amount,
    nextBillingDate,
    subscriptionId,
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jstNextBilling = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
  }).format(nextBillingDate)

  const planLabel = planType === 'monthly' ? '月額プラン' : '年額プラン'
  const subject = `${groupName} メンバーシップへようこそ`

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、${groupName} のメンバーシップへのご登録が完了しました。</p>

    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;border:1px solid #eee;">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">グループ</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${groupName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">プラン</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${planLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">金額</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">¥${amount.toLocaleString()} / ${planType === 'monthly' ? '月' : '年'}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;">次回更新日</td>
        <td style="padding:8px 12px;">${jstNextBilling}</td>
      </tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      メンバー限定コンテンツへのアクセス、限定グッズの先行予約など、様々な特典をお楽しみください。
    </p>

    <p style="margin-top:12px;font-size:14px;">
      サブスクリプションの管理は<a href="https://playtune.jp/subscription" style="color:#3366cc;text-decoration:none;">こちら</a>から行えます。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE STORE サポートチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}

/** サブスクリプション解約メール */
export async function sendSubscriptionCancelEmail(params: {
  to: string
  userName?: string
  groupName: string
  planType: 'monthly' | 'yearly'
  canceledAt: Date
  periodEnd: Date
  subscriptionId: string
}) {
  const {
    to,
    userName,
    groupName,
    planType,
    canceledAt,
    periodEnd,
    subscriptionId,
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jstCanceled = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(canceledAt)

  const jstPeriodEnd = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
  }).format(periodEnd)

  const planLabel = planType === 'monthly' ? '月額プラン' : '年額プラン'
  const subject = `${groupName} メンバーシップの解約のお知らせ`

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、${groupName} のメンバーシップの解約手続きが完了しました。</p>

    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;border:1px solid #eee;">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">グループ</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${groupName}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">プラン</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${planLabel}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">解約日時</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${jstCanceled}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;">利用可能期限</td>
        <td style="padding:8px 12px;">${jstPeriodEnd}まで</td>
      </tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;background:#fff3cd;padding:12px;border-radius:6px;border:1px solid #ffc107;">
      <strong>ご注意：</strong>次回の自動更新はキャンセルされましたが、現在の契約期間（${jstPeriodEnd}まで）は引き続きメンバー特典をご利用いただけます。
    </p>

    <p style="margin-top:12px;font-size:14px;">
      いつでも再登録いただけます。またのご利用をお待ちしております。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE STORE サポートチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}

/** 支払い方法変更メール */
export async function sendPaymentMethodUpdateEmail(params: {
  to: string
  userName?: string
  groupName: string
  newPaymentMethod: {
    brand: string
    last4: string
  }
  updatedAt: Date
  ip?: string
  ua?: string
}) {
  const {
    to,
    userName,
    groupName,
    newPaymentMethod,
    updatedAt,
    ip,
    ua,
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const approxLocation = await resolveLocation(ip)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = process.env.MAIL_FROM_NAME || 'PLAY TUNE ID'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(updatedAt)

  const subject = `${groupName} メンバーシップの支払い方法が変更されました`

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <h2 style="margin:.6em 0 0;font-size:20px;">${subject}</h2>

    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、${groupName} のメンバーシップの支払い方法が変更されました。</p>

    <table style="border-collapse:collapse;margin-top:12px;font-size:14px;border:1px solid #eee;">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">新しい支払い方法</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${newPaymentMethod.brand.toUpperCase()} **** ${newPaymentMethod.last4}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">変更日時</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${jst}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">操作元</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${approxLocation}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;color:#555;">端末</td>
        <td style="padding:8px 12px;">${ua ? ua.replace(/</g,'&lt;') : '-'}</td>
      </tr>
    </table>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      次回の更新時より、新しい支払い方法で自動的に決済が行われます。
    </p>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      ご本人による操作でない場合は、直ちに
      <a href="https://playtune.jp/subscription" style="color:#3366cc;text-decoration:none;">サブスクリプション管理ページ</a>
      から支払い方法を確認し、<a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">サポート窓口</a>までご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE STORE サポートチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}
/** お問い合わせ自動返信メール */
export async function sendContactAutoReplyEmail(params: {
  to: string
  userName: string
  message: string
  submittedAt?: Date
}) {
  const {
    to,
    userName,
    message,
    submittedAt = new Date(),
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = 'PLAY TUNE STORE'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(submittedAt)

  const subject = '[PLAY TUNE STORE]お問い合わせを受け付けました'

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <p>${userName} 様</p>

    <p>以下の内容でお問い合わせを受け付けました。<br/>
    このメールは自動送信されています。</p>

    <div style="margin:16px 0;padding:16px;background:#f9fafb;border-left:4px solid #7b7b7bff;border-radius:4px;">
      <div style="font-size:13px;color:#666;margin-bottom:8px;">受付日時：${jst}</div>
      <div style="font-size:14px;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g,'&lt;')}</div>
    </div>

    <div style="margin:20px 0;padding:16px;">
      <p style="margin:0 0 8px;font-weight:600;font-size:14px;"></p>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
        <li>お問い合わせ内容を確認のうえ、担当者より<strong>3営業日を目安</strong>にご返信いたします。</li>
        <li>お問い合わせの内容によっては、お時間をいただく場合がございます。</li>
        <li>営業時間：平日 10:00〜18:00（土日祝日を除く）</li>
        <li>返信メールが届かない場合、迷惑メールフォルダに振り分けられている場合がございますので、ご確認ください。</li>
      </ul>
    </div>

    <p style="margin-top:16px;font-size:14px;line-height:1.6;">
      なお、このメールにご返信いただいてもお答えできませんので、ご了承ください。<br/>
      追加のお問い合わせがある場合は、改めて<a href="https://playtune.jp/contact" style="color:#3366cc;text-decoration:none;">お問い合わせフォーム</a>よりご連絡ください。
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE STORE サポートチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}


/** Special Cheer送信完了メール */
export async function sendSuperThanksConfirmationEmail(params: {
  to: string
  userName?: string
  postId: string
  postTitle: string
  groupName?: string
  amount: number
  message?: string
  paidAt?: Date
  orderId?: string
}) {
  const {
    to,
    userName,
    postId,
    postTitle,
    groupName,
    amount,
    message,
    paidAt = new Date(),
    orderId,
  } = params

  const { toList, noteHtml } = resolveRecipients(to)

  const fromAddr =
    extractEmail(process.env.MAIL_FROM_ADDRESS) ||
    extractEmail(process.env.MAIL_FROM)
  if (!fromAddr) throw new Error('MAIL_FROM_ADDRESS is missing or invalid.')
  const displayName = 'PLAY TUNE STORE'
  const sourceHeader = formatFrom(displayName, fromAddr)

  const jst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(paidAt)

  const subject = '[PLAY TUNE STORE]Special Cheerを送信しました 🎉'

  // 税込金額を計算
  const totalAmount = amount + Math.round(amount * 0.1)

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#333">
    <p style="font-size:15px;">PLAY TUNE をご利用いただきありがとうございます。</p>

    <p>${userName ?? 'ユーザー'} さん、Special Cheerの送信が完了しました。ご支援いただき誠にありがとうございます。</p>

    <div style="margin:20px 0;padding:20px;background:linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);border-radius:12px;border:1px solid #fdba74;">
      <div style="display:flex;align-items:center;margin-bottom:12px;">
        <span style="font-size:32px;margin-right:12px;">🎉</span>
        <div>
          <div style="font-size:18px;font-weight:600;color:#ea580c;">¥${amount.toLocaleString()}</div>
          <div style="font-size:12px;color:#9a3412;">Special Cheer</div>
        </div>
      </div>
    </div>

    <table style="border-collapse:collapse;margin-top:16px;font-size:14px;width:100%;border:1px solid #eee;">
      <tr>
        <td style="padding:12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;width:120px;">送信先</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <strong>${postTitle}</strong>
          ${groupName ? `<br/><span style="color:#666;font-size:13px;">${groupName}</span>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;">金額</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          ¥${amount.toLocaleString()}<br/>
        </td>
      </tr>
      ${message ? `
      <tr>
        <td style="padding:12px;background:#f9fafb;color:#555;border-bottom:1px solid #eee;vertical-align:top;">メッセージ</td>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <div style="background:#eff6ff;padding:12px;border-radius:6px;border-left:3px solid #ffffffff;white-space:pre-wrap;line-height:1.6;">${message.replace(/</g,'&lt;')}</div>
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding:12px;background:#f9fafb;color:#555;">送信日時</td>
        <td style="padding:12px;">${jst}</td>
      </tr>
    </table>

    <div style="margin:20px 0;padding:16px;background:#f0fdf4;border-radius:8px;">
      <p style="margin:0 0 8px;font-size:14px;color:#166534;">
        <strong>✓ Special CheerがPLAY TUNEに届きました</strong>
      </p>
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
        Special Cheerはタレントの活動や楽曲制作等に活用されます。<br>引き続きPLAY TUNEの応援をよろしくお願いいたします。
      </p>
    </div>

    ${orderId ? `
    <p style="margin-top:16px;font-size:12px;color:#888;">
      注文番号：${orderId}
    </p>
    ` : ''}

    <p style="margin-top:16px;font-size:14px;line-height:1.6;color:#666;">
      ※ Special Cheerは返金できません。<br/>
    </p>

    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>

    <p style="font-size:12px;color:#888;">
      PLAY TUNE STORE サポートチーム<br/>
      <a href="https://playtune.jp/contact" style="color:#888;text-decoration:none;">お問い合わせはこちら</a>
    </p>

    ${noteHtml}
  </div>
  `

  const cmd = new SendEmailCommand({
    Source: sourceHeader,
    Destination: {
      ToAddresses: toList,
      BccAddresses: process.env.MAIL_BCC ? [process.env.MAIL_BCC] : undefined,
    },
    ReplyToAddresses: process.env.REPLY_TO ? [process.env.REPLY_TO] : ['support@playtune.jp'],
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  })

  await ses.send(cmd)
}