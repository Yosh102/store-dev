// lib/fetch-with-auth.ts
// Firebase認証 + CSRF保護付きの統一fetchヘルパー

import { fetchCSRFToken } from '@/lib/csrf'

/**
 * Firebase ID Token + CSRF Token 付きでfetchを実行
 * 
 * @param getIdToken - Firebase認証のgetIdToken関数
 * @param input - fetch URL
 * @param init - fetch options
 * @returns fetch Response
 */
export async function fetchWithAuth(
  getIdToken: () => Promise<string>,
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  try {
    // Firebase認証トークンを取得
    const idToken = await getIdToken()
    if (!idToken) {
      throw new Error('認証が必要です。ログインし直してください。')
    }

    // CSRFトークンを取得（POSTリクエストの場合）
    let csrfToken = ''
    if (init.method && init.method.toUpperCase() !== 'GET') {
      csrfToken = await fetchCSRFToken()
    }

    // ヘッダーを設定
    const headers = new Headers(init.headers || {})
    headers.set('Authorization', `Bearer ${idToken}`)
    
    // CSRFトークンを追加（POSTリクエストの場合）
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }

    // Content-Typeを設定（GETでない場合）
    if (!headers.has('Content-Type') && init.method && init.method !== 'GET') {
      headers.set('Content-Type', 'application/json')
    }

    // fetchを実行
    return fetch(input, {
      ...init,
      headers,
      credentials: 'include', // クッキーも送信
    })
  } catch (error) {
    console.error('fetchWithAuth error:', error)
    throw error
  }
}

/**
 * fetchWithAuthのカスタムフック版（React用）
 */
export function useFetchWithAuth(getIdToken: () => Promise<string>) {
  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    return fetchWithAuth(getIdToken, input, init)
  }
}