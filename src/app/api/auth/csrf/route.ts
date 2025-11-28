// app/api/auth/csrf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * CSRFトークンを生成するAPI
 */
export async function GET(request: NextRequest) {
  // トークンを生成
  const token = crypto.randomBytes(32).toString('hex');
  
  // トークンの有効期限（1時間）
  const expires = new Date(Date.now() + 60 * 60 * 1000);
  
  // レスポンスの設定
  const response = NextResponse.json({ 
    success: true,
    token,
  });
  
  // HTTPOnlyクッキーとしてトークンを設定
  response.cookies.set({
    name: 'csrf_token',
    value: token,
    expires,
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  return response;
}