"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp, loginWithGoogle, loginWithApple } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useGoogleReCaptcha } from "@/lib/recaptcha";
import { fetchCSRFToken } from "@/lib/csrf";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnJapanesePackage from "@zxcvbn-ts/language-ja";
import { Input } from "@/components/ui/input";
import {
  MailIcon,
  LockIcon,
  ShieldIcon,
  CheckCircle2,
  XCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const options = {
  translations: zxcvbnJapanesePackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnJapanesePackage.dictionary,
  },
};
zxcvbnOptions.setOptions(options);

export default function SignUpClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);
  const [passwordStrengthText, setPasswordStrengthText] = useState("");
  const [showPopupHelp, setShowPopupHelp] = useState(false);
  const [popupHelpReason, setPopupHelpReason] =
    useState<"popup-blocked" | "not-supported" | "unknown" | null>(null);

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

  const passwordRequirements = [
    { regex: /.{10,}/, text: "10文字以上" },
    { regex: /[A-Z]/, text: "大文字を含む" },
    { regex: /[a-z]/, text: "小文字を含む" },
    { regex: /[0-9]/, text: "数字を含む" },
    { regex: /[!@#$%^&*]/, text: "特殊文字を含む (!@#$%^&*)" },
  ];

  useEffect(() => {
    (async () => {
      try {
        const token = await fetchCSRFToken();
        setCsrfToken(token);
      } catch (e) {
        setError(
          "セキュリティトークンの取得に失敗しました。ページを再読み込みしてください。"
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (password) {
      const result = zxcvbn(password, [email, email.split("@")[0]]);
      setPasswordScore(result.score);

      const feedbackArray: string[] = [];
      if (result.feedback.warning) feedbackArray.push(result.feedback.warning);
      if (result.feedback.suggestions?.length)
        feedbackArray.push(...result.feedback.suggestions);
      setPasswordFeedback(feedbackArray);

      const strengthTexts = ["非常に弱い", "弱い", "まあまあ", "強い", "非常に強い"];
      setPasswordStrengthText(strengthTexts[result.score]);
    } else {
      setPasswordScore(0);
      setPasswordFeedback([]);
      setPasswordStrengthText("");
    }
  }, [password, email]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    const disposableEmailDomains = ["tempmail.com", "throwawaymail.com", "yopmail.com"];
    const domain = email.split("@")[1];
    if (disposableEmailDomains.includes(domain)) return false;
    return true;
  };

  const validatePassword = (p: string): boolean =>
    passwordRequirements.every((req) => req.regex.test(p));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!showPassword) {
      setShowPassword(true);
      return;
    }
    if (!email || !password || !confirmPassword) {
      setError("すべての項目を入力してください");
      return;
    }
    if (!validateEmail(email)) {
      setError("有効なメールアドレスを入力してください");
      return;
    }
    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }
    if (!validatePassword(password)) {
      setError(
        "パスワードがすべての要件を満たしていません。大文字、小文字、数字、特殊文字を含む10文字以上のパスワードを設定してください。"
      );
      return;
    }
    if (!agreeToTerms) {
      setError("利用規約に同意してください");
      return;
    }
    if (!csrfToken) {
      setError("セキュリティトークンが無効です。ページを再読み込みしてください。");
      return;
    }
    if (!executeRecaptcha) {
      setError("reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const captchaToken = await executeRecaptcha("signup");
      if (!captchaToken) {
        setError("セキュリティチェックに失敗しました。");
        return;
      }

      await signUp(email, password, email.split("@")[0], {
        csrfToken,
        captchaToken,
      });

      const verifyEmailUrl =
        redirectUrl !== "/"
          ? `/verify-email?redirect=${encodeURIComponent(redirectUrl)}`
          : "/verify-email";
      router.push(verifyEmailUrl);
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("このメールアドレスは既に使用されています");
      } else if (error.code === "auth/invalid-email") {
        setError("メールアドレスの形式が正しくありません");
      } else if (error.code === "auth/weak-password") {
        setError("より強力なパスワードを設定してください");
      } else {
        setError(
          `新規登録に失敗しました: ${error.message || "もう一度お試しください。"}`
        );
      }
    } finally {
      setLoading(false);
    }
  };
// 追加
const showGuide = (reason: "popup-blocked" | "not-supported" | "unknown") => {
  setPopupHelpReason(reason);
  setShowPopupHelp(true);
};
// 変更（try/catchを強化）
const handleGoogleSignUp = async () => {
  try {
    setError("");
    const redirectPath = decodeURIComponent(redirectUrl);
    localStorage.setItem("postAuthRedirect", redirectPath);
    await loginWithGoogle(csrfToken || undefined);
  } catch (e: any) {
    const code = (e?.code || e?.message || "").toString();
    if (code.includes("popup-closed-by-user") || code.includes("popup-blocked")) {
      showGuide("popup-blocked");
    } else if (code.includes("operation-not-supported-in-this-environment")) {
      showGuide("not-supported");
    } else {
      showGuide("unknown");
    }
    setError("Googleアカウント登録に失敗しました");
  }
};

const handleAppleSignUp = async () => {
  try {
    setError("");
    const redirectPath = decodeURIComponent(redirectUrl);
    localStorage.setItem("postAuthRedirect", redirectPath);
    await loginWithApple(csrfToken || undefined);
  } catch (e: any) {
    const code = (e?.code || e?.message || "").toString();
    if (code.includes("popup-closed-by-user") || code.includes("popup-blocked")) {
      showGuide("popup-blocked");
    } else if (code.includes("operation-not-supported-in-this-environment")) {
      showGuide("not-supported");
    } else {
      showGuide("unknown");
    }
    setError("Appleアカウント登録に失敗しました");
  }
};

// 追加
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
        <XCircle className="w-4 h-4" />
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
              それでも開かない場合は、数秒後に再度お試しください（ポップアップを許可してから）。
            </li>
            <li>
              参考:
              <a
                href="https://support.apple.com/ja-jp/102524"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 ml-1 underline"
              >
                iPhone/iPadのポップアップ設定
              </a>
              /
              <a
                href="https://support.google.com/chrome/answer/95472?hl=ja&co=GENIE.Platform%3DAndroid"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 ml-1 underline"
              >
                Chrome のポップアップ設定
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
      const passwordInput = document.getElementById(
        "password"
      ) as HTMLInputElement | null;
      if (passwordInput) passwordInput.focus();
    }
  }, [showPassword]);

  const getPasswordStrengthColor = () => {
    const colors = [
      "text-red-500",
      "text-orange-500",
      "text-yellow-500",
      "text-green-500",
      "text-emerald-500",
    ];
    return colors[passwordScore] || "";
  };
  const getStrengthBarStyle = () => {
    const widths = ["w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"];
    const colors = [
      "bg-red-500",
      "bg-orange-500",
      "bg-yellow-500",
      "bg-green-500",
      "bg-emerald-500",
    ];
    return `${widths[passwordScore]} ${colors[passwordScore]}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="absolute top-12 left-4">
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
            <h1 className="text-2xl font-bold mt-4">PLAY TUNE IDを登録</h1>
            <p className="text-[24px] text-gray-600">
              {showPassword ? "パスワードを設定してください" : "メールアドレスを入力してください"}
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-4">
              {/* メール */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-6 z-10">
                  <MailIcon className="h-4 w-4 text-gray-400" />
                </span>
                <Input
                  type="email"
                  placeholder="メールアドレスを入力"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={showPassword || loading}
                  autoComplete="email"
                  className="pl-12 h-12"
                />
              </div>

              {/* パスワード群 */}
              <div
                className={`transition-all duration-300 ease-in-out space-y-4 ${
                  showPassword
                    ? "max-h-[1000px] opacity-100"
                    : "max-h-0 opacity-0 overflow-hidden"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    className="pl-12 h-12"
                  />
                </div>

                {/* 強度インジケーター */}
                {password && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">パスワード強度:</span>
                      <span className={`text-sm font-medium ${getPasswordStrengthColor()}`}>
                        {passwordStrengthText}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getStrengthBarStyle()} transition-all duration-300`}
                      />
                    </div>
                    {passwordFeedback.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        <div className="flex items-start">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 mr-2" />
                          <ul className="list-disc list-inside">
                            {passwordFeedback.map((feedback, idx) => (
                              <li key={idx}>{feedback}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 確認 */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-6 z-10">
                    <LockIcon className="h-4 w-4 text-gray-400" />
                  </span>
                  <Input
                    type="password"
                    placeholder="パスワード（確認）"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="new-password"
                    className="pl-12 h-12"
                  />
                </div>

                {/* 要件チェック */}
                <div className="text-[14px] space-y-2">
                  {passwordRequirements.map((req, index) => {
                    const ok = req.regex.test(password);
                    return (
                      <div key={index} className="flex items-center">
                        {ok ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span>{req.text}</span>
                      </div>
                    );
                  })}
                </div>

                {/* reCAPTCHA 表示 */}
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

                {/* 規約同意 */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="agreeToTerms"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    className="mr-2 h-4 w-4 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
                  />
                  <label htmlFor="agreeToTerms" className="text-[14px] text-gray-600">
                    <a
                      href="/terms-of-service"
                      className="text-gray-500 hover:underline font-bold"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      利用規約
                    </a>
                    および
                    <a
                      href="/privacy-policy"
                      className="text-gray-500 hover:underline font-bold ml-1"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      プライバシーポリシー
                    </a>
                    に同意します
                  </label>
                </div>
              </div>
            </div>

            {/* エラー */}
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
            {renderPopupHelp()}
            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white h-12"
              disabled={loading}
            >
              {loading ? "お待ちください..." : showPassword ? "新規登録" : "続行"}
            </Button>
          </form>

          {/* 区切り */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-[14px]">
              <span className="px-2 bg-white text-gray-500">または</span>
            </div>
          </div>

          {/* 連携ボタン：Google / Apple */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleSignUp}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 h-12"
              disabled={loading}
            >
              <span className="mr-2 inline-flex w-5 h-5 items-center justify-center">
                <img src="/icons/google.svg" alt="Google" className="w-5 h-5 block" />
              </span>
              <span>Googleで続ける</span>
            </Button>

            <Button
              type="button"
              onClick={handleAppleSignUp}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 h-12"
              disabled={loading}
            >
              <span className="mr-2 inline-flex w-5 h-5 items-center justify-center">
                <img src="/icons/apple.svg" alt="Apple" className="w-5 h-5 block" />
              </span>
              <span>Appleで続ける</span>
            </Button>
          </div>

          {/* ログイン導線 */}
          <p className="text-[14px] text-center text-gray-600">
            すでにアカウントをお持ちの方は{" "}
            <button
              onClick={() =>
                router.push(
                  `/login${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`
                )
              }
              className="text-gray-500 hover:underline font-bold"
              disabled={loading}
            >
              ログイン
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
