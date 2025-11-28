// lib/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  sendEmailVerification as firebaseSendEmailVerification,
  applyActionCode,
  fetchSignInMethodsForEmail,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  UserCredential,
  User as FirebaseUser,
  OAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { createCouponForUser } from "./stripe-utils";
import { ensureDefaultCampaign } from "./campaign-utils";
import { addCSRFTokenToHeaders } from "./csrf";

/* ======================== Types ======================== */
interface AuthOptions {
  csrfToken?: string;
  captchaToken?: string;
  rememberMe?: boolean;
}
// === 追加: iOS 判定（iPadOSのMac表記も考慮） ===
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";
  const maxTouch = (navigator as any).maxTouchPoints || 0;

  const isiOSUA = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS13Plus = /Macintosh/i.test(ua) && maxTouch > 1;
  const isiOSPlatform = /iPhone|iPad|iPod/i.test(platform);

  return isiOSUA || isIPadOS13Plus || isiOSPlatform;
}

/* ======================== Helpers ======================== */
function isPasswordStrong(password: string): boolean {
  // 10文字以上（コメントと実装を統一）
  if (password.length < 10) return false;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  return hasUppercase && hasLowercase && hasNumbers && hasSpecialChar;
}

function isWithinCampaignPeriod(): boolean {
  const campaignEndDate = new Date("2025-12-31T23:59:59");
  return new Date() <= campaignEndDate;
}

async function createAndAssignCoupon(userId: string): Promise<string | null> {
  if (!isWithinCampaignPeriod()) return null;
  try {
    await ensureDefaultCampaign();
    const couponCode = await createCouponForUser(userId);
    await setDoc(doc(db, "users", userId), { couponCode }, { merge: true });
    return couponCode;
  } catch {
    return null;
  }
}

async function verifyCaptcha(token: string): Promise<boolean> {
  try {
    if (!token) return false;
    const res = await fetch("/api/auth/verify-captcha", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...addCSRFTokenToHeaders() },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      await res.json().catch(() => ({}));
      return false;
    }
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

async function logAuthEvent(userId: string, event: string, details: any) {
  try {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "server";
    const timestamp = serverTimestamp();
    const ipAddress =
      typeof fetch !== "undefined"
        ? await fetch("/api/auth/get-client-ip").then((r) => r.text()).catch(() => "")
        : "";
    await setDoc(doc(db, "authLogs", `${userId}_${Date.now()}`), {
      userId,
      event,
      details,
      userAgent,
      timestamp,
      ipAddress,
    });
  } catch {}
}

/** SES通知（ログイン/サインアップ） */
async function notifyLoginToSes(eventType: "login" | "signup" = "login") {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch("/api/log/notify-login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ eventType }),
    });
  } catch {}
}

/** セッション永続性（iOS/PWA 安定化） */
async function ensureSessionPersistence() {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch {}
}

/** OAuth 後の統一処理 */
async function finalizeOAuthLogin(user: FirebaseUser, provider: "google" | "apple") {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const couponCode = await createAndAssignCoupon(user.uid);
    await setDoc(ref, {
      email: user.email,
      name: user.displayName,
      displayName: user.displayName,
      photoURL: user.photoURL ?? null,
      role: "user",
      emailVerified: user.emailVerified,
      createdAt: serverTimestamp(),
      couponCode,
      provider,
    });
    await logAuthEvent(user.uid, "signup", { method: provider, email: user.email });
    await notifyLoginToSes("signup");
  } else {
    await logAuthEvent(user.uid, "login", { method: provider, email: user.email });
    await notifyLoginToSes("login");
  }
}

/** リダイレクト先の決定（URLパラメータ優先・両対応） */
function getRedirectDestination(): string {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);

  // ① login系で使うことがある ?redirect=...
  const fromRedirect = params.get("redirect");
  if (fromRedirect) {
    try {
      const decoded = decodeURIComponent(fromRedirect);
      // 外部URLや絶対URLは無効化（内部パスのみ許可）
      if (decoded.startsWith("/")) {
        console.log("📍 Redirect from ?redirect:", decoded);
        return decoded;
      }
    } catch {}
  }

  // ② OAuth開始時に付与している ?postAuthRedirect=...
  const fromPost = params.get("postAuthRedirect");
  if (fromPost) {
    try {
      const decoded = decodeURIComponent(fromPost);
      if (decoded.startsWith("/")) {
        console.log("📍 Redirect from ?postAuthRedirect:", decoded);
        return decoded;
      }
    } catch {}
  }

  // ③ localStorage フォールバック
  const fromStorage = localStorage.getItem("postAuthRedirect");
  if (fromStorage && fromStorage.startsWith("/")) {
    console.log("📍 Redirect from localStorage:", fromStorage);
    return fromStorage;
  }

  // ④ デフォルト
  console.log("📍 Redirect to default: /");
  return "/";
}

/** OAuth 開始：popup → redirect フォールバック */
async function startOAuth(
  provider: GoogleAuthProvider | OAuthProvider,
  mode: "popup" | "redirect"
): Promise<UserCredential | never> {
  await ensureSessionPersistence();
  
  if (mode === "redirect") {
    const redirectPath = localStorage.getItem("postAuthRedirect") || "/";
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("postAuthRedirect", redirectPath); // encodeURIComponent削除
    
    console.log("🚀 Starting OAuth redirect");
    console.log("📍 Redirect path saved in URL:", redirectPath);
    console.log("🔗 Full URL:", currentUrl.toString());
    
    window.history.replaceState(null, "", currentUrl.toString());
  }
  
  if (mode === "popup") {
    return await signInWithPopup(auth, provider);
  }
  
  await signInWithRedirect(auth, provider);
  return new Promise<UserCredential>(() => {});
}

function safeReplace(path: string) {
  if (!path) return;
  if (path === window.location.pathname && !window.location.search) return; // 変化なしなら何もしない
  window.location.replace(path);
}
// グローバルフラグ（確実に一度だけ実行）
let redirectHandlerExecuted = false;
let redirectHandlerPromise: Promise<void> | null = null;

export async function initAuthRedirectHandler() {
  // すでに実行中または完了している場合
  if (redirectHandlerPromise) {
    console.log("⏭️ initAuthRedirectHandler: already running");
    return redirectHandlerPromise;
  }

  if (redirectHandlerExecuted) {
    console.log("⏭️ initAuthRedirectHandler: already executed");
    return;
  }

  redirectHandlerExecuted = true;
  
  redirectHandlerPromise = (async () => {
    try {

      // OAuth redirect後の結果を取得（redirect使用時のみ）
      const result = await getRedirectResult(auth).catch((e) => {
        console.error("❌ getRedirectResult error:", e);
        return null;
      });

      if (result && result.user) {
        const pid = (result.providerId || "").toLowerCase();
        const provider: "google" | "apple" = pid.includes("google") ? "google" : "apple";
        console.log("✅ OAuth redirect detected:", provider, result.user.uid);

        await finalizeOAuthLogin(result.user, provider);

        const to = getRedirectDestination();
        console.log("📍 Will redirect to:", to);

        // クリーンアップ
        localStorage.removeItem("postAuthRedirect");

        // セッション確立を待つ
        await new Promise((r) => setTimeout(r, 800));

        // リダイレクト実行
        const current = window.location.pathname + window.location.search;
        if (to && current !== to) {
          console.log("🔄 Redirecting:", current, "→", to);
          window.location.replace(to);
        } else {
        }
      } else {
      }

    } catch (e) {
    }
  })();

  return redirectHandlerPromise;
}


/* ======================== Email / Password ======================== */
export const signUp = async (email: string, password: string, name: string, options?: AuthOptions) => {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length > 0) throw new Error("このメールアドレスは既に登録されています");

    if (options?.csrfToken) {
      const ok = await fetch("/api/auth/verify-csrf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...addCSRFTokenToHeaders() },
        body: JSON.stringify({ token: options.csrfToken }),
      }).then((r) => r.json()).then((d) => d.valid);
      if (!ok) throw new Error("セキュリティトークンが無効です");
    }

    if (options?.captchaToken) {
      const ok = await verifyCaptcha(options.captchaToken);
      if (!ok) throw new Error("CAPTCHA検証に失敗しました");
    }

    if (!isPasswordStrong(password)) throw new Error("パスワードが要件を満たしていません");

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const couponCode = await createAndAssignCoupon(user.uid);
    await setDoc(doc(db, "users", user.uid), {
      email,
      name,
      displayName: name,
      createdAt: serverTimestamp(),
      role: "user",
      emailVerified: false,
      couponCode,
    });

    await logAuthEvent(user.uid, "signup", { email, name });
    await sendVerificationEmail(user);
    await notifyLoginToSes("signup");

    return { user, couponCode };
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      throw new Error("このメールアドレスは既に使用されています");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("無効なメールアドレス形式です");
    } else if (error.code === "auth/weak-password") {
      throw new Error("パスワードが脆弱です");
    } else if (error.code === "auth/network-request-failed") {
      throw new Error("ネットワークエラーが発生しました");
    } else if (error.message) {
      throw new Error(error.message);
    }
    throw error;
  }
};

export const login = async (email: string, password: string, options?: AuthOptions) => {
  try {
    if (options?.csrfToken) {
      const ok = await fetch("/api/auth/verify-csrf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...addCSRFTokenToHeaders() },
        body: JSON.stringify({ token: options.csrfToken }),
      }).then((r) => r.json()).then((d) => d.valid);
      if (!ok) throw new Error("セキュリティトークンが無効です");
    }

    if (options?.captchaToken) {
      const ok = await verifyCaptcha(options.captchaToken);
      if (!ok) throw new Error("CAPTCHA検証に失敗しました");
    }

    const persistenceType = options?.rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistenceType);

    const cred = await signInWithEmailAndPassword(auth, email, password);

    await logAuthEvent(cred.user.uid, "login", { method: "email", email });
    await notifyLoginToSes("login");

    return cred.user;
  } catch (error: any) {
    try {
      await logAuthEvent("failed_login", "login_failed", { email });
    } catch {}
    if (error.code === "auth/wrong-password" || error.code === "auth/user-not-found") {
      throw new Error("メールアドレスまたはパスワードが正しくありません");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("ログイン試行回数が多すぎます。しばらく経ってからお試しください。");
    } else if (error.code === "auth/user-disabled") {
      throw new Error("このアカウントは無効化されています");
    } else if (error.code === "auth/invalid-credential") {
      throw new Error("認証情報が無効です");
    } else if (error.message) {
      throw new Error(error.message);
    }
    throw error;
  }
};
// === Google ログイン：全デバイスでポップアップ ===
export const loginWithGoogle = async (csrfToken?: string): Promise<UserCredential["user"]> => {
  if (csrfToken) {
    const ok = await fetch("/api/auth/verify-csrf", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...addCSRFTokenToHeaders() },
      body: JSON.stringify({ token: csrfToken }),
    }).then((r) => r.json()).then((d) => d.valid);
    if (!ok) throw new Error("セキュリティトークンが無効です");
  }

  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");
  provider.setCustomParameters({ prompt: "select_account" });

  await ensureSessionPersistence();

  const cred = await signInWithPopup(auth, provider);
  
  await finalizeOAuthLogin(cred.user, "google");
  
  // セッション確立を待つ
  await new Promise(r => setTimeout(r, 1000));
  
  return cred.user;
};

// === Apple ログイン：全デバイスでポップアップ ===
export const loginWithApple = async (csrfToken?: string): Promise<UserCredential["user"]> => {
  if (csrfToken) {
    const ok = await fetch("/api/auth/verify-csrf", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...addCSRFTokenToHeaders() },
      body: JSON.stringify({ token: csrfToken }),
    }).then((r) => r.json()).then((d) => d.valid);
    if (!ok) throw new Error("セキュリティトークンが無効です");
  }

  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");

  const rawNonce = generateRandomNonce();
  const hashed = await sha256(rawNonce);
  provider.setCustomParameters({ nonce: hashed });

  await ensureSessionPersistence();

  const cred = await signInWithPopup(auth, provider);
  
  await finalizeOAuthLogin(cred.user, "apple");
  
  // セッション確立を待つ
  await new Promise(r => setTimeout(r, 1000));
  
  return cred.user;
};


/* ======================== Common Utils ======================== */
export const logout = async () => {
  try {
    const userId = auth.currentUser?.uid;
    await signOut(auth);
    if (userId) await logAuthEvent(userId, "logout", {});
  } catch (e) {
    throw e;
  }
};

export const verifyEmail = async (oobCode: string) => {
  try {
    await applyActionCode(auth, oobCode);
    await auth.currentUser?.reload();
    if (auth.currentUser?.uid) {
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        { emailVerified: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
      await logAuthEvent(auth.currentUser.uid, "email_verified", {});
    }
    return true;
  } catch (e) {
    throw e;
  }
};

export const sendVerificationEmail = async (user: FirebaseUser) => {
  try {
    await firebaseSendEmailVerification(user, {
      url: `${window.location.origin}/verify-email?uid=${user.uid}`,
      handleCodeInApp: true,
    });
    await logAuthEvent(user.uid, "verification_email_sent", { email: user.email });
  } catch (e) {
    throw e;
  }
};

export const isOrderOwner = async (userId: string, orderId: string) => {
  const orderDoc = await getDoc(doc(db, "orders", orderId));
  if (!orderDoc.exists()) return false;
  return orderDoc.data().userId === userId;
};

export const getCurrentUser = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  return { uid: user.uid, ...snap.data() };
};

/** Apple Sign-In 推奨: nonce 生成 & SHA-256 */
function generateRandomNonce(length = 32) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (v) => chars[v % chars.length]).join("");
}

async function sha256(message: string) {
  const enc = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}