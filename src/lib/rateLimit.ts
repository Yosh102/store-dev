// 超軽量なレートリミッター（メモリ上でIP単位に制御）
const BUCKET = new Map<string, { tokens: number; updatedAt: number }>();

export type RateLimitOptions = {
  windowMs: number; // 制限の有効時間（ミリ秒）
  max: number; // 許可回数
};

/**
 * @param key - 通常はIPアドレス
 * @param options - windowMsとmax
 * @returns true = 通過OK, false = ブロック
 */
export function rateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const slot = BUCKET.get(key);

  if (!slot) {
    BUCKET.set(key, { tokens: options.max - 1, updatedAt: now });
    return true;
  }

  if (now - slot.updatedAt > options.windowMs) {
    slot.tokens = options.max - 1;
    slot.updatedAt = now;
    return true;
  }

  if (slot.tokens > 0) {
    slot.tokens -= 1;
    return true;
  }

  return false;
}