// app/api/auth/get-client-ip/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // クライアントIPを取得するための各種ヘッダーを確認
    // 順番に優先度の高いヘッダーから確認
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const connectionRemoteAddress = request.headers.get('connection-remote-address');
    
    // IPアドレスの候補
    const ipCandidates = [
      forwarded,
      realIp, 
      connectionRemoteAddress,
      // request.ip は NextRequest 型に存在しないため削除
    ].filter(Boolean); // nullや undefined を除外
    
    // 最初の有効なIPアドレスを使用
    let clientIp = '127.0.0.1'; // デフォルト値
    
    for (const candidate of ipCandidates) {
      if (candidate) {
        // カンマで区切られた場合は最初のIPを取得（プロキシ経由の場合）
        const firstIp = candidate.split(',')[0].trim();
        if (firstIp) {
          clientIp = firstIp;
          break;
        }
      }
    }
    
    // IPアドレスの簡易的な検証（形式のみ）
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-f0-9:]+$/i;
    if (!ipRegex.test(clientIp)) {
      clientIp = '127.0.0.1'; // 無効な場合はデフォルトに戻す
    }
    
    // セキュリティとプライバシーのためIPを部分的に難読化
    // 例: 192.168.1.1 -> 192.168.1.x
    const obscuredIp = clientIp.replace(/\.\d+$|\:[0-9a-f]+$/i, (match) => {
      return match.startsWith('.') ? '.x' : ':xxxx';
    });

    // テキスト形式で返す
    return new NextResponse(obscuredIp);
  } catch (error) {
    console.error('Error getting client IP:', error);
    return new NextResponse('127.0.0.1');
  }
}