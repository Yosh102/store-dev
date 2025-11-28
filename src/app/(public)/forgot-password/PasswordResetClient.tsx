'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock, faCheckCircle, faTimesCircle, faShield, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { useGoogleReCaptcha } from '@/lib/recaptcha';
import { fetchCSRFToken } from '@/lib/csrf';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnJapanesePackage from '@zxcvbn-ts/language-ja';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/firebase';
import { 
  sendPasswordResetEmail, 
  verifyPasswordResetCode, 
  confirmPasswordReset 
} from 'firebase/auth';

const options = {
  translations: zxcvbnJapanesePackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnJapanesePackage.dictionary,
  },
};
zxcvbnOptions.setOptions(options);

export default function PasswordResetClient() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);
  const [passwordStrengthText, setPasswordStrengthText] = useState('');
  const [stage, setStage] = useState<'request' | 'reset'>('request');
  const [actionCode, setActionCode] = useState<string | null>(null);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();
  const searchParams = useSearchParams();

  const passwordRequirements = [
    { regex: /.{10,}/, text: '10文字以上' },
    { regex: /[A-Z]/, text: '大文字を含む' },
    { regex: /[a-z]/, text: '小文字を含む' },
    { regex: /[0-9]/, text: '数字を含む' },
    { regex: /[!@#$%^&*]/, text: '特殊文字を含む' },
    { validation: () => passwordScore >= 3, text: '十分な強度がある' },
  ];

  // CSRFトークンを取得
  useEffect(() => {
    const getCSRFToken = async () => {
      try {
        const token = await fetchCSRFToken();
        setCsrfToken(token);
      } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        setError('セキュリティトークンの取得に失敗しました。ページを再読み込みしてください。');
      }
    };
    
    getCSRFToken();
  }, []);

  // URLパラメータからoobCodeを取得
  useEffect(() => {
    const oobCode = searchParams.get('oobCode');
    if (oobCode) {
      setActionCode(oobCode);
      setStage('reset');
      
      // oobCodeの検証
      verifyPasswordResetCode(auth, oobCode)
        .then(email => {
          // 検証成功、メールアドレスをセット
          setEmail(email);
        })
        .catch(error => {
          console.error('Invalid or expired action code', error);
          setError('リセットリンクが無効または期限切れです。再度パスワードリセットを行ってください。');
          setStage('request');
        });
    } else {
      setStage('request');
    }
  }, [searchParams]);

  // パスワードの強度評価
  useEffect(() => {
    if (newPassword) {
      const result = zxcvbn(newPassword, [email, email.split('@')[0]]);
      setPasswordScore(result.score);
      
      const feedbackArray = [];
      if (result.feedback.warning) {
        feedbackArray.push(result.feedback.warning);
      }
      
      if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
        feedbackArray.push(...result.feedback.suggestions);
      }
      
      setPasswordFeedback(feedbackArray);
      
      // 強度のテキスト表示
      const strengthTexts = ['非常に弱い', '弱い', 'まあまあ', '強い', '非常に強い'];
      setPasswordStrengthText(strengthTexts[result.score]);
    } else {
      setPasswordScore(0);
      setPasswordFeedback([]);
      setPasswordStrengthText('');
    }
  }, [newPassword, email]);

  // メールアドレスの検証
  const validateEmail = (email: string): boolean => {
    // 基本的なメール形式のチェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    // 使い捨てメールドメインのチェック（例）
    const disposableEmailDomains = ['tempmail.com', 'throwawaymail.com', 'yopmail.com'];
    const domain = email.split('@')[1];
    if (disposableEmailDomains.includes(domain)) return false;
    
    return true;
  };

  // パスワードリセットメール送信
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }
    
    // メールアドレスの検証
    if (!validateEmail(email)) {
      setError('有効なメールアドレスを入力してください');
      return;
    }
    
    // CSRF対策: トークンが取得できていない場合はエラー
    if (!csrfToken) {
      setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
      return;
    }
    
    // CAPTCHA検証
    if (!executeRecaptcha) {
      setError('reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // reCAPTCHA v3トークンの取得
      const captchaToken = await executeRecaptcha('password_reset');
      if (!captchaToken) {
        setError('セキュリティチェックに失敗しました。');
        return;
      }
      
      // CSRFトークンを検証
      const csrfValidResponse = await fetch('/api/auth/verify-csrf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: csrfToken }),
      });
      
      const csrfValidData = await csrfValidResponse.json();
      if (!csrfValidData.valid) {
        setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
        return;
      }
      
      // パスワードリセットメール送信
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/forgot-password`,
        handleCodeInApp: false,
      });
      
      // 監査ログに記録
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'password_reset_requested',
          details: { email },
        }),
      });
      
      setSuccess('パスワードリセットのメールを送信しました。メールの指示に従ってパスワードをリセットしてください。');
      
    } catch (error: any) {
      console.error("Password reset email error:", error);
      
      // エラーメッセージを表示
      if (error.code === 'auth/user-not-found') {
        // セキュリティのため、ユーザーが存在しなくても成功メッセージを表示
        setSuccess('パスワードリセットのメールを送信しました。メールの指示に従ってパスワードをリセットしてください。');
      } else if (error.code === 'auth/invalid-email') {
        setError('無効なメールアドレス形式です');
      } else if (error.code === 'auth/too-many-requests') {
        setError('試行回数が多すぎます。しばらくしてからやり直してください。');
      } else {
        setError('パスワードリセットメールの送信に失敗しました: ' + (error.message || 'エラーが発生しました'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 新しいパスワードの設定
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      setError('すべての項目を入力してください');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    
    if (!passwordRequirements.every(req => req.regex ? req.regex.test(newPassword) : req.validation ? req.validation() : false)) {
      setError('パスワードがすべての要件を満たしていません');
      return;
    }
    
    // CSRF対策: トークンが取得できていない場合はエラー
    if (!csrfToken) {
      setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
      return;
    }
    
    // CAPTCHA検証
    if (!executeRecaptcha) {
      setError('reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。');
      return;
    }
    
    if (!actionCode) {
      setError('リセットコードが見つかりません。リンクが無効または期限切れです。');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // reCAPTCHA v3トークンの取得
      const captchaToken = await executeRecaptcha('password_reset_confirm');
      if (!captchaToken) {
        setError('セキュリティチェックに失敗しました。');
        return;
      }
      
      // CSRFトークンを検証
      const csrfValidResponse = await fetch('/api/auth/verify-csrf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: csrfToken }),
      });
      
      const csrfValidData = await csrfValidResponse.json();
      if (!csrfValidData.valid) {
        setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
        return;
      }
      
      // パスワードのリセット
      await confirmPasswordReset(auth, actionCode, newPassword);
      
      // 監査ログに記録
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'password_reset_completed',
          details: { email },
        }),
      });
      
      setSuccess('パスワードがリセットされました。新しいパスワードでログインできます。');
      
      // 3秒後にログインページにリダイレクト
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      // エラーメッセージを表示
      if (error.code === 'auth/expired-action-code') {
        setError('リセットリンクの有効期限が切れています。再度パスワードリセットを行ってください。');
        setStage('request');
      } else if (error.code === 'auth/invalid-action-code') {
        setError('リセットリンクが無効です。再度パスワードリセットを行ってください。');
        setStage('request');
      } else if (error.code === 'auth/weak-password') {
        setError('より強力なパスワードを設定してください');
      } else {
        setError('パスワードのリセットに失敗しました: ' + (error.message || 'エラーが発生しました'));
      }
    } finally {
      setLoading(false);
    }
  };

  // パスワード強度のカラーを取得
  const getPasswordStrengthColor = () => {
    const colors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-500'];
    return colors[passwordScore] || '';
  };

  // 強度表示バーのスタイル
  const getStrengthBarStyle = () => {
    const widths = ['w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
    return `${widths[passwordScore]} ${colors[passwordScore]}`;
  };

  // メールフォーム（リクエストステージ）
  const renderRequestForm = () => (
    <form onSubmit={handleSendResetEmail} className="space-y-4">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
        </span>
        <Input
          type="email"
          placeholder="メールアドレスを入力"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
          className="pl-12"
        />
      </div>
      
      {/* reCAPTCHA 利用規約表示部分 */}
      <div className="my-4 p-4 bg-gray-50 text-sm text-gray-600 rounded border border-gray-200">
        このサイトはreCAPTCHAによって保護されており、Googleの
        <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>および
        <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">利用規約</a>が適用されます。
      </div>
      
      <Button
        type="submit"
        className="w-full bg-black hover:bg-gray-800 text-white"
        disabled={loading}
      >
        {loading ? 'お待ちください...' : 'パスワードリセットメールを送信'}
      </Button>
    </form>
  );

  // パスワードリセットフォーム（リセットステージ）
  const renderResetForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-4">
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <FontAwesomeIcon icon={faLock} className="text-gray-400" />
        </span>
        <Input
          type="password"
          placeholder="新しいパスワード"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          className="pl-12"
        />
      </div>
      
      {/* パスワード強度インジケーター */}
      {newPassword && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">パスワード強度:</span>
            <span className={`text-sm font-medium ${getPasswordStrengthColor()}`}>
              {passwordStrengthText}
            </span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full ${getStrengthBarStyle()} transition-all duration-300`}></div>
          </div>
          {passwordFeedback.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              <div className="flex items-start">
                <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 mt-1 mr-2" />
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
      
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
          <FontAwesomeIcon icon={faLock} className="text-gray-400" />
        </span>
        <Input
          type="password"
          placeholder="新しいパスワード（確認）"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          className="pl-12"
        />
      </div>
      
      <div className="text-[14px] space-y-2">
        {passwordRequirements.map((req, index) => (
          <div key={index} className="flex items-center">
            <FontAwesomeIcon 
              icon={(req.regex && req.regex.test(newPassword)) || (req.validation && req.validation()) ? faCheckCircle : faTimesCircle} 
              className={(req.regex && req.regex.test(newPassword)) || (req.validation && req.validation()) ? "text-green-500 mr-2" : "text-red-500 mr-2"} 
            />
            <span>{req.text}</span>
          </div>
        ))}
      </div>
      
      {/* reCAPTCHA 利用規約表示部分 */}
      <div className="my-4 p-4 bg-gray-50 text-sm text-gray-600 rounded border border-gray-200">
        このサイトはreCAPTCHAによって保護されており、Googleの
        <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>および
        <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">利用規約</a>が適用されます。
      </div>
      
      <Button
        type="submit"
        className="w-full bg-black hover:bg-gray-800 text-white"
        disabled={loading}
      >
        {loading ? 'お待ちください...' : 'パスワードをリセット'}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="space-y-6">
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold">パスワードをお忘れですか？</h1>
            <p className="text-[24px] text-gray-600">
              {stage === 'request' 
                ? 'アカウントのメールアドレスを入力してください' 
                : '新しいパスワードを設定してください'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FontAwesomeIcon icon={faShield} className="text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              </div>
            </div>
          )}

          {stage === 'request' ? renderRequestForm() : renderResetForm()}

          <p className="text-[14px] text-center text-gray-600">
            <button
              onClick={() => router.push('/login')}
              className="text-gray-500 hover:underline font-bold" 
              disabled={loading}
            >
              ログインページに戻る
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}