import CryptoJS from 'crypto-js'

// 環境変数から暗号化キーを取得
const MEMBERSHIP_SECRET_KEY = process.env.NEXT_PUBLIC_MEMBERSHIP_ID_SECRET_KEY || 'PRYMEMEMBERSHIPID202501010128'

/**
 * ユーザーIDを暗号化してメンバーシップIDを生成
 */
export function generateMembershipId(userId: string): string {
  try {
    const encrypted = CryptoJS.AES.encrypt(userId, MEMBERSHIP_SECRET_KEY).toString()
    // バーコードに適した形式に変換（英数字のみ）
    return encrypted.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 12)
  } catch (error) {
    console.error('Error generating membership ID:', error)
    // フォールバック：ユーザーIDをベースにした簡単なハッシュ
    return userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 12).padEnd(12, '0')
  }
}

/**
 * メンバーシップIDからユーザーIDを復号化
 */
export function decryptMembershipId(membershipId: string): string | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(membershipId, MEMBERSHIP_SECRET_KEY)
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Error decrypting membership ID:', error)
    return null
  }
}

/**
 * バーコード用のSVGを生成（Code 128風のシンプルなバーコード）
 */
export function generateBarcodePattern(membershipId: string): string {
  // メンバーシップIDを数値に変換してバーコードパターンを生成
  const pattern: number[] = []
  
  for (let i = 0; i < membershipId.length; i++) {
    const char = membershipId.charCodeAt(i)
    // 各文字から1-4の幅を生成
    const width = (char % 4) + 1
    pattern.push(width)
  }
  
  return pattern.join(',')
}

/**
 * バーコードSVGを生成
 */
export function generateBarcodeSVG(membershipId: string, width: number = 200, height: number = 50): string {
  const pattern = generateBarcodePattern(membershipId)
  const bars = pattern.split(',').map(Number)
  
  let x = 0
  const barWidth = width / bars.reduce((sum, bar) => sum + bar, 0)
  
  const rects = bars.map((barHeight, index) => {
    const isBlack = index % 2 === 0
    const rect = `<rect x="${x}" y="0" width="${barWidth * barHeight}" height="${height}" fill="${isBlack ? '#000' : '#fff'}" />`
    x += barWidth * barHeight
    return rect
  }).join('')
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      ${rects}
    </svg>
  `
}