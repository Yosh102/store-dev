// lib/csrf-server.ts
// サーバー側のCSRF検証ヘルパー
import { NextRequest } from 'next/server'
import crypto from 'crypto'

/**
 * CSRFトークンを検証（サーバー側）
 */
export function verifyCSRFToken(req: NextRequest): boolean {
  const headerToken = req.headers.get('x-csrf-token')
  const cookieToken = req.cookies.get('csrf_token')?.value
  
  if (!headerToken || !cookieToken) {
    console.error('CSRF token missing:', { 
      hasHeader: !!headerToken, 
      hasCookie: !!cookieToken 
    })
    return false
  }
  
  try {
    const headerBuf = Buffer.from(headerToken)
    const cookieBuf = Buffer.from(cookieToken)
    
    if (headerBuf.length !== cookieBuf.length) {
      console.error('CSRF token length mismatch')
      return false
    }
    
    const isValid = crypto.timingSafeEqual(headerBuf, cookieBuf)
    
    if (!isValid) {
      console.error('CSRF token mismatch')
    }
    
    return isValid
  } catch (error) {
    console.error('CSRF token verification error:', error)
    return false
  }
}

/**
 * CSRF検証失敗時のセキュリティログを記録
 */
export async function logCSRFFailure(
  req: NextRequest,
  endpoint: string,
  adminDb: any
): Promise<void> {
  try {
    await adminDb.collection('securityLogs').add({
      type: 'csrf_token_failure',
      endpoint,
      timestamp: new Date(),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown'
    })
  } catch (err) {
    console.error('Failed to log CSRF failure:', err)
  }
}