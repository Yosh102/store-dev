// lib/csrf.ts
import { getCookie } from 'cookies-next';

/**
 * CSRFトークンを生成して取得する
 * 既にクッキーに存在する場合はそれを返し、存在しない場合は新規生成
 */
export const fetchCSRFToken = async (): Promise<string> => {
  try {
    // 常に新しいトークンを生成する
    const response = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('CSRFトークンの取得に失敗しました');
    }
    
    const data = await response.json();
    const token = data.token;
    
    // 開発環境の場合、デバッグ用に出力
    if (process.env.NODE_ENV !== 'production') {
      // console.log('CSRF Token fetched:', token);
    }
    
    return token || '';
  } catch (error) {
    // console.error('CSRF token fetch error:', error);
    return '';
  }
};

/**
 * CSRFトークンをリクエストヘッダーに追加するためのヘルパー関数
 */
export const addCSRFTokenToHeaders = (headers: Record<string, string> = {}): Record<string, string> => {
  const token = getCookie('csrf_token');
  if (token) {
    return {
      ...headers,
      'X-CSRF-Token': token as string,
    };
  }
  return headers;
};
