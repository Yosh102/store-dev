// app/api/auth/verify-captcha/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Google reCAPTCHA 検証用のエンドポイント
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';
const CSRF_COOKIE_NAME = 'csrf_token';

export async function POST(request: NextRequest) {
  try {
    // 環境変数チェック
    if (!RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }

    // リクエストボディからトークンを取得
    const body = await request.json();
    const token = body.token;
    
    if (!token) {
      console.error('No reCAPTCHA token provided in request');
      return NextResponse.json({
        success: false,
        error: 'Token is required'
      }, { status: 400 });
    }

    // 開発環境では検証をスキップする設定
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_RECAPTCHA === 'true') {
      console.warn('Development mode: Bypassing reCAPTCHA verification');
      return NextResponse.json({
        success: true,
        score: 1.0,
        dev_mode: true
      });
    }

    console.log('Verifying reCAPTCHA token:', token.substring(0, 20) + '...');

    // Google reCAPTCHA APIに検証リクエストを送信
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    if (!response.ok) {
      console.error('reCAPTCHA API request failed:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        error: 'Failed to verify with reCAPTCHA service'
      }, { status: 502 });
    }

    const data = await response.json();
    console.log('reCAPTCHA API response:', data);

    // Google APIのレスポンスを元に判定
    if (!data.success) {
      console.error('reCAPTCHA verification failed:', data['error-codes']);
      return NextResponse.json({
        success: false,
        error: 'reCAPTCHA verification failed',
        details: data['error-codes']
      }, { status: 400 });
    }

    // スコアが低すぎる場合（v3の場合）
    if (data.score !== undefined && data.score < 0.5) {
      console.warn('reCAPTCHA score too low:', data.score);
      return NextResponse.json({
        success: false,
        error: 'reCAPTCHA score too low',
        score: data.score
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      score: data.score
    });
  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}