"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, loginWithGoogle, loginWithApple } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGoogleReCaptcha } from "@/lib/recaptcha";
import { fetchCSRFToken } from "@/lib/csrf";
import { MailIcon, LockIcon, ShieldIcon, ArrowLeft, ExternalLink, Info, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

interface LoginAttempts {
  count: number;
  lockUntil?: number;
}

export default function LoginClient() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempts>({ count: 0 });

  const [showPopupHelp, setShowPopupHelp] = useState(false);
  const [popupHelpReason, setPopupHelpReason] = useState<"popup-blocked" | "not-supported" | "unknown" | null>(null);

  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams?.get("redirect") || "/";

  // すでにログイン済みなら抜ける
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        const next =
          localStorage.getItem("postAuthRedirect") ||
          decodeURIComponent(redirectUrl) ||
          "/";
        localStorage.removeItem("postAuthRedirect");
        router.replace(next);
      }
    });
    return () => unsub();
  }, [router, redirectUrl]);

  useEffect(() => {
    (async () => {
      try {
        const token = await fetchCSRFToken();
        setCsrfToken(token);
      } catch (e) {
        console.error("Failed to fetch CSRF token:", e);
        setError(
          "セキュリティトークンの取得に失敗しました。ページを再読み込みしてください。"
        );
      }
    })();
  }, []);

  // ログイン試行カウント
  useEffect(() => {
    const storedAttempts = localStorage.getItem("loginAttempts");
    if (storedAttempts) {
      const attempts = JSON.parse(storedAttempts) as LoginAttempts;
      if (attempts.lockUntil && new Date().getTime() < attempts.lockUntil) {
        const remainingMinutes = Math.ceil(
          (attempts.lockUntil - new Date().getTime()) / (60 * 1000)
        );
        setError(
          `セキュリティのため、アカウントは${remainingMinutes}分間ロックされています。しばらく経ってからお試しください。`
        );
      } else if (attempts.lockUntil && new Date().getTime() >= attempts.lockUntil) {
        setLoginAttempts({ count: 0 });
        localStorage.setItem("loginAttempts", JSON.stringify({ count: 0 }));
      } else {
        setLoginAttempts(attempts);
        if (attempts.count >= 3) setShowCaptcha(true);
      }
    }
  }, []);

  const incrementLoginAttempts = () => {
    const newAttempts = {
      count: loginAttempts.count + 1,
      lockUntil:
        loginAttempts.count >= 4
          ? new Date().getTime() + 30 * 60 * 1000
          : undefined,
    };
    setLoginAttempts(newAttempts);
    localStorage.setItem("loginAttempts", JSON.stringify(newAttempts));
    if (newAttempts.count >= 3) setShowCaptcha(true);
    if (newAttempts.lockUntil) {
      setError(
        "セキュリティのため、アカウントは30分間ロックされました。しばらく経ってからお試しください。"
      );
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts({ count: 0 });
    localStorage.setItem("loginAttempts", JSON.stringify({ count: 0 }));
    setShowCaptcha(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // ロック中
    if (loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil) {
      const remainingMinutes = Math.ceil(
        (loginAttempts.lockUntil - new Date().getTime()) / (60 * 1000)
      );
      setError(
        `セキュリティのため、アカウントは${remainingMinutes}分間ロックされています。しばらく経ってからお試しください。`
      );
      return;
    }

    if (!showPassword) {
      if (!identifier) {
        setError("メールアドレスを入力してください");
        return;
      }
      setShowPassword(true);
      setError("");
      return;
    }

    if (!identifier || !password) {
      setError("メールアドレスとパスワードを入力してください");
      return;
    }
    if (!csrfToken) {
      setError("セキュリティトークンが無効です。ページを再読み込みしてください。");
      return;
    }

    // reCAPTCHA（必要時）
    let captchaToken: string | null = null;
    if (showCaptcha) {
      if (!executeRecaptcha) {
        setError("reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。");
        return;
      }
      captchaToken = await executeRecaptcha("login");
      if (!captchaToken) {
        setError("セキュリティチェックに失敗しました。");
        return;
      }
    }

    try {
      setLoading(true);
      setError("");

      await login(identifier, password, {
        csrfToken,
        captchaToken: captchaToken || undefined,
      });

      resetLoginAttempts();

      // 通常ログインはここで遷移
      const next = decodeURIComponent(redirectUrl) || "/";
      router.push(next);
    } catch (error: any) {
      if (
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError("メールアドレスまたはパスワードが正しくありません");
      } else if (error.code === "auth/too-many-requests") {
        setError("ログイン試行回数が多すぎます。しばらく経ってからお試しください。");
      } else if (error.code === "auth/invalid-credential") {
        setError("認証情報が無効です。正しい情報を入力してください。");
      } else {
        setError("ログインに失敗しました。もう一度お試しください。");
      }
      incrementLoginAttempts();
    } finally {
      setLoading(false);
    }
  };

  // --- OAuth（ポップアップ→ダメなら自動リダイレクト） ---
  const showGuide = (reason: "popup-blocked" | "not-supported" | "unknown") => {
    setPopupHelpReason(reason);
    setShowPopupHelp(true);
  };

const handleGoogleLogin = async () => {
  try {
    setError("");
    
    const redirectPath = decodeURIComponent(redirectUrl);
    
    // localStorageに保存
    localStorage.setItem("postAuthRedirect", redirectPath);
    await loginWithGoogle(csrfToken || undefined);
    
  } catch (e: any) {
    
    const code = (e?.code || e?.message || "").toString();
    if (code.includes("popup-closed-by-user")) {
      showGuide("popup-blocked");
    } else if (code.includes("popup-blocked")) {
      showGuide("popup-blocked");
    } else if (code.includes("operation-not-supported-in-this-environment")) {
      showGuide("not-supported");
    } else {
      showGuide("unknown");
    }
    setError("Googleログインに失敗しました");
  }
};
const handleAppleLogin = async () => {
  try {

    setError("");
    
    const redirectPath = decodeURIComponent(redirectUrl);
    
    // localStorageに保存
    localStorage.setItem("postAuthRedirect", redirectPath);
    
    // loginWithAppleを呼ぶ
    await loginWithApple(csrfToken || undefined);
    
  } catch (e: any) {
    const code = (e?.code || e?.message || "").toString();
    if (code.includes("popup-closed-by-user")) {
      showGuide("popup-blocked");
    } else if (code.includes("popup-blocked")) {
      showGuide("popup-blocked");
    } else if (code.includes("operation-not-supported-in-this-environment")) {
      showGuide("not-supported");
    } else {
      showGuide("unknown");
    }
    setError("Appleログインに失敗しました");
  }
};


  const renderPopupHelp = () => {
    if (!showPopupHelp) return null;

    const reasonLabel =
      popupHelpReason === "popup-blocked"
        ? "ポップアップがブロックされた可能性があります。"
        : popupHelpReason === "not-supported"
        ? "この環境ではポップアップがサポートされていない可能性があります。"
        : "ポップアップが開けませんでした。";

    return (
      <div className="relative rounded-md bg-gray-50 p-4 text-sm text-gray-900">
        <button
          aria-label="閉じる"
          onClick={() => setShowPopupHelp(false)}
          className="absolute right-2 top-2 rounded p-1 hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold mb-1">{reasonLabel}</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                ブラウザで <span className="font-semibold">ポップアップを許可</span> してください。
              </li>
              <li>
                それでも開かない場合は、<span className="font-semibold">自動でリダイレクト</span>して認証を試みます（数秒待っても変化が無い場合は再度お試しください）。
              </li>
              <li>
                参考:
                <a
                  href="https://support.apple.com/ja-jp/102524"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 ml-1 underline"
                >
                  iPhone/iPadのポップアップ設定 <ExternalLink className="w-3 h-3" />
                </a>
                /
                <a
                  href="https://support.google.com/chrome/answer/95472?hl=ja&co=GENIE.Platform%3DAndroid"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 ml-1 underline"
                >
                  Chrome のポップアップ設定 <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showPassword) {
      const el = document.getElementById("password") as HTMLInputElement | null;
      if (el) el.focus();
    }
  }, [showPassword]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4 relative">
      {/* 戻る */}
      <div className="absolute top-16 left-4">
        <button
          type="button"
          onClick={() => {
            const ref = document.referrer;
            const origin = window.location.origin;
            const isInternalReferrer = ref.startsWith(origin);
            if (isInternalReferrer && window.history.length > 1) {
              router.back();
            } else {
              router.push("/");
            }
          }}
          className="flex items-center text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-1" />
          <span className="text-sm font-bold">PLAY TUNE STOREへ戻る</span>
        </button>
      </div>

      <div className="w-full max-w-[480px] mx-auto">
        <div className="space-y-6">
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold mt-4">PLAY TUNE IDでログイン</h1>
            <p className="text-[24px] text-gray-600">
              {showPassword ? "パスワードを入力してください" : "メールアドレスを入力してください"}
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-4">
              {/* メール */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-6 z-10">
                  <MailIcon className="h-4 w-4 text-gray-400" />
                </span>
                <Input
                  type="email"
                  placeholder="メールアドレスを入力"
                  className="pl-12 h-12"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={showPassword || loading}
                  autoComplete="email"
                />
              </div>

              {/* パスワード（段階表示） */}
              <div
                className={`transition-all duration-300 ease-in-out ${
                  showPassword ? "max-h-20 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
                }`}
              >
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-6 z-10">
                    <LockIcon className="h-4 w-4 text-gray-400" />
                  </span>
                  <Input
                    id="password"
                    type="password"
                    placeholder="パスワード"
                    className="pl-12 h-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {/* reCAPTCHA 注意書き（必要時） */}
              {showCaptcha && showPassword && (
                <div className="my-4 p-4 bg-gray-50 text-sm text-gray-600 rounded border border-gray-200">
                  このサイトはreCAPTCHAによって保護されており、Googleの
                  <a
                    href="https://policies.google.com/privacy"
                    className="text-blue-600 hover:underline ml-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    プライバシーポリシー
                  </a>
                  および
                  <a
                    href="https://policies.google.com/terms"
                    className="text-blue-600 hover:underline ml-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    利用規約
                  </a>
                  が適用されます。
                </div>
              )}
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ShieldIcon className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ガイド表示（ポップアップ問題時） */}
            {renderPopupHelp()}

            {/* ログイン */}
            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white h-12"
              disabled={
                loading || !!(loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil)
              }
            >
              {loading ? "お待ちください..." : showPassword ? "ログイン" : "続行"}
            </Button>

            {/* パスワード忘れ */}
            {showPassword && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/forgot-password${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`
                    )
                  }
                  className="text-sm text-gray-500 hover:underline"
                >
                  パスワードをお忘れですか？
                </button>
              </div>
            )}
          </form>

          {/* 区切り */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-[14px]">
              <span className="px-2 bg-white text-gray-500">または</span>
            </div>
          </div>

          {/* 連携ログイン（Google / Apple） */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 h-12"
              disabled={
                loading || !!(loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil)
              }
            >
              <span className="mr-2 inline-flex w-5 h-5 items-center justify-center">
                <img src="/icons/google.svg" alt="Google" className="w-5 h-5 block" />
              </span>
              <span>Googleで続ける</span>
            </Button>

            <Button
              type="button"
              onClick={handleAppleLogin}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 h-12"
              disabled={
                loading || !!(loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil)
              }
            >
              <span className="mr-2 inline-flex w-5 h-5 items-center justify-center">
                <img src="/icons/apple.svg" alt="Apple" className="w-5 h-5 block" />
              </span>
              <span>Appleで続ける</span>
            </Button>
          </div>

          {/* サインアップ導線 */}
          <p className="text-[14px] text-center text-gray-600">
            アカウントをお持ちでない方は{" "}
            <button
              onClick={() =>
                router.push(
                  `/signup${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`
                )
              }
              className="text-gray-500 hover:underline font-bold"
              disabled={loading}
            >
              新規登録
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
