// app/api/auth/verify-csrf/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    const cookieToken = request.cookies.get('csrf_token')?.value;
    
    // デバッグ用
    console.log('CSRF Verification:', { 
      providedToken: token, 
      cookieToken, 
      match: token === cookieToken 
    });
    
    // 開発環境では常に検証を通過させる（オプション）
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ valid: true });
    }
    
    // 本番環境では厳密にチェック
    if (token && cookieToken && token === cookieToken) {
      return NextResponse.json({ valid: true });
    }
    
    return NextResponse.json({ 
      valid: false,
      error: "Invalid token" 
    }, { status: 403 });
  } catch (error) {
    console.error('Error in CSRF verification:', error);
    return NextResponse.json({ 
      valid: false, 
      error: "Server error" 
    }, { status: 500 });
  }
}