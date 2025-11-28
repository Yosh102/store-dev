import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// インメモリストレージ（本番環境ではRedisなどの外部ストレージを推奨）
type RateLimitStorage = {
  [key: string]: {
    count: number;
    timestamp: number;
  };
};

const ipRequests: RateLimitStorage = {};

// ミドルウェアの設定
export const config = {
  matcher: [
    // 認証関連のAPIパスだけにマッチング
    '/api/auth/:path*', 
    '/api/user/:path*'
  ],
};

/**
 * レート制限ミドルウェア
 * - 特定のIPアドレスからの過剰なリクエストを制限
 * - 認証関連のAPIに対して適用
 */
export async function middleware(request: NextRequest) {
  // IPアドレスを取得（プロキシ経由の場合はX-Forwarded-Forヘッダー）
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  
  // リクエストパス
  const path = request.nextUrl.pathname;
  
  // ユニークなキーを作成（IPアドレスとパスの組み合わせ）
  const key = `${ip}:${path}`;
  
  // 現在の時間
  const now = Date.now();
  
  // 期限切れのエントリをクリア（10分経過したもの）
  Object.keys(ipRequests).forEach(k => {
    if (now - ipRequests[k].timestamp > 10 * 60 * 1000) {
      delete ipRequests[k];
    }
  });
  
  // リクエスト情報を取得または初期化
  const requestInfo = ipRequests[key] || { count: 0, timestamp: now };
  
  // カウントを増加
  requestInfo.count += 1;
  
  // 初回アクセスの場合はタイムスタンプを更新
  if (requestInfo.count === 1) {
    requestInfo.timestamp = now;
  }
  
  // ストレージに保存
  ipRequests[key] = requestInfo;
  
  // パスに応じたレート制限の閾値を設定
  let threshold = 20; // デフォルト
  let windowSizeMinutes = 10; // デフォルト: 10分間
  
  if (path.includes('/login') || path.includes('/signup')) {
    threshold = 5; // ログイン・サインアップは制限を厳しく
    windowSizeMinutes = 10;
  } else if (path.includes('/password-reset')) {
    threshold = 3; // パスワードリセットは更に厳しく
    windowSizeMinutes = 30;
  }
  
  // レート制限を超えたかチェック
  if (requestInfo.count > threshold) {
    // ヘッダーにレート制限情報を追加
    return new NextResponse(JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests, please try again in ${windowSizeMinutes} minutes.`
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        // レート制限情報をレスポンスヘッダーに含める
        'X-RateLimit-Limit': threshold.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': (Math.floor(requestInfo.timestamp / 1000) + windowSizeMinutes * 60).toString(),
        'Retry-After': (windowSizeMinutes * 60).toString()
      }
    });
  }
  
  // レート制限情報をヘッダーに追加して次のハンドラに渡す
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', threshold.toString());
  response.headers.set('X-RateLimit-Remaining', (threshold - requestInfo.count).toString());
  response.headers.set('X-RateLimit-Reset', (Math.floor(requestInfo.timestamp / 1000) + windowSizeMinutes * 60).toString());
  
  return response;
}
