// /src/lib/paidy.ts
import crypto from "crypto";

/**
 * Paidy 決済を作成（オーソリ）
 */
export async function paidyCreate(token: string, amount: number) {
  console.log("[paidyCreate] sending amount to Paidy:", amount);
  console.log(
    "[paidyCreate] using secret key prefix:",
    process.env.PAIDY_SECRET_KEY?.slice(0, 8)
  );

  const res = await fetch("https://api.paidy.com/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Paidy-Version": "2018-04-10",
      Authorization: `Bearer ${process.env.PAIDY_SECRET_KEY}`,
    },
    body: JSON.stringify({
      amount,
      currency: "JPY",
      capture: false, // オーソリのみ
      token,
      description: "PLAY TUNE Order",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[paidyCreate] error response:", text);
    throw new Error(text);
  }

  const json = await res.json();
  console.log("[paidyCreate] Paidy response:", json);
  return json;
}

/**
 * Paidy Webhook 署名検証
 * @param payload - 生のリクエストボディ
 * @param signature - ヘッダー `Paidy-Signature`
 */
export function verifyPaidySignature(payload: string, signature: string): boolean {
  try {
    const secret = process.env.PAIDY_WEBHOOK_SECRET!;
    if (!secret) {
      console.error("Missing PAIDY_WEBHOOK_SECRET");
      return false;
    }

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");

    return expected === signature;
  } catch (err) {
    console.error("verifyPaidySignature error:", err);
    return false;
  }
}