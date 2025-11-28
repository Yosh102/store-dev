'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faCheckCircle, faTimesCircle, faShield, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { faGoogle, faApple } from '@fortawesome/free-brands-svg-icons';
import { useGoogleReCaptcha } from '@/lib/recaptcha';
import { fetchCSRFToken } from '@/lib/csrf';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnJapanesePackage from '@zxcvbn-ts/language-ja';
import { Input } from '@/components/ui/input';
import { auth } from '@/lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const options = {
  translations: zxcvbnJapanesePackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnJapanesePackage.dictionary,
  },
};
zxcvbnOptions.setOptions(options);

export default function PasswordChangeClient() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);
  const [passwordStrengthText, setPasswordStrengthText] = useState('');
  const [hasPasswordProvider, setHasPasswordProvider] = useState<boolean | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();

  const passwordRequirements = [
    { regex: /.{10,}/, text: '10文字以上' },
    { regex: /[A-Z]/, text: '大文字を含む' },
    { regex: /[a-z]/, text: '小文字を含む' },
    { regex: /[0-9]/, text: '数字を含む' },
    { regex: /[!@#$%^&*]/, text: '特殊文字を含む' },
    { validation: () => passwordScore >= 3, text: '十分な強度がある' },
  ];

  // プロバイダー情報を取得
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const providerIds = user.providerData.map(p => p.providerId);
      setProviders(providerIds);
      setHasPasswordProvider(providerIds.includes('password'));
    }
  }, []);

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

  // パスワードの強度評価
  useEffect(() => {
    if (newPassword) {
      const userEmail = auth.currentUser?.email || '';
      const result = zxcvbn(newPassword, [userEmail, userEmail.split('@')[0]]);
      setPasswordScore(result.score);
      
      const feedbackArray = [];
      if (result.feedback.warning) {
        feedbackArray.push(result.feedback.warning);
      }
      
      if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
        feedbackArray.push(...result.feedback.suggestions);
      }
      
      setPasswordFeedback(feedbackArray);
      
      const strengthTexts = ['非常に弱い', '弱い', 'まあまあ', '強い', '非常に強い'];
      setPasswordStrengthText(strengthTexts[result.score]);
    } else {
      setPasswordScore(0);
      setPasswordFeedback([]);
      setPasswordStrengthText('');
    }
  }, [newPassword]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('すべての項目を入力してください');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }
    
    if (!passwordRequirements.every(req => req.regex ? req.regex.test(newPassword) : req.validation ? req.validation() : false)) {
      setError('パスワードがすべての要件を満たしていません');
      return;
    }
    
    if (!csrfToken) {
      setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
      return;
    }
    
    if (!executeRecaptcha) {
      setError('reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const captchaToken = await executeRecaptcha('password_change');
      if (!captchaToken) {
        setError('セキュリティチェックに失敗しました。');
        return;
      }
      
      const user = auth.currentUser;
      if (!user || !user.email) {
        setError('ログインセッションが無効です。再度ログインしてください。');
        return;
      }
      
      const credential = EmailAuthProvider.credential(
        user.email, 
        currentPassword
      );
      
      try {
        await reauthenticateWithCredential(user, credential);
      } catch (reauthError: any) {
        console.error('Reauthentication error:', reauthError);
        
        if (reauthError.code === 'auth/wrong-password' || reauthError.code === 'auth/invalid-credential') {
          throw new Error('現在のパスワードが正しくありません。もう一度確認してください。');
        } else if (reauthError.code === 'auth/too-many-requests') {
          throw new Error('試行回数が多すぎます。しばらくしてからやり直してください。');
        } else if (reauthError.code === 'auth/user-mismatch') {
          throw new Error('認証情報が一致しません。再度ログインしてください。');
        } else if (reauthError.code === 'auth/user-not-found') {
          throw new Error('ユーザーが見つかりません。再度ログインしてください。');
        } else if (reauthError.code === 'auth/invalid-email') {
          throw new Error('メールアドレスの形式が正しくありません。');
        } else {
          throw new Error(`再認証に失敗しました: ${reauthError.message}`);
        }
      }
      
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
      
      await updatePassword(user, newPassword);
      
      const uaString = navigator.userAgent;
      let ip = '';
      try {
        const r = await fetch('/api/auth/get-client-ip');
        ip = r.ok ? await r.text() : '';
      } catch {}

      await fetch('/api/log/notify-password-changed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          userName: user.displayName || user.email,
          ua: uaString,
          ip,
          changedAt: new Date().toISOString(),
        }),
      });
      
      await fetch('/api/auth/log-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'password_changed',
          userId: user.uid,
        }),
      });
      
      setSuccess('パスワードが正常に変更されました');
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
    } catch (error: any) {
      console.error("Password change error:", error);
      
      if (error.message) {
        setError(error.message);
      } else if (error.code === 'auth/weak-password') {
        setError('パスワードが弱すぎます。より強力なパスワードを設定してください。');
      } else if (error.code === 'auth/requires-recent-login') {
        setError('セキュリティのため再度ログインが必要です。一度ログアウトして再度ログインしてください。');
        setTimeout(() => {
          router.push('/logout');
        }, 3000);
      } else {
        setError('パスワード変更に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthColor = () => {
    const colors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-500'];
    return colors[passwordScore] || '';
  };

  const getStrengthBarStyle = () => {
    const widths = ['w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];
    return `${widths[passwordScore]} ${colors[passwordScore]}`;
  };

  const getProviderName = (providerId: string) => {
    switch (providerId) {
      case 'google.com':
        return 'Google';
      case 'apple.com':
        return 'Apple';
      case 'password':
        return 'メール/パスワード';
      default:
        return providerId;
    }
  };

  const getProviderIcon = (providerId: string) => {
    switch (providerId) {
      case 'google.com':
        return <FontAwesomeIcon icon={faGoogle} className="text-gray-500" />;
      case 'apple.com':
        return <FontAwesomeIcon icon={faApple} className="text-gray-500" />;
      case 'password':
        return <FontAwesomeIcon icon={faLock} className="text-gray-500" />;
      default:
        return null;
    }
  };

  // ローディング中
  if (hasPasswordProvider === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // パスワードプロバイダーがない場合
  if (!hasPasswordProvider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-[480px] mx-auto">
          <div className="space-y-6">
            <div className="text-left space-y-2">
              <h1 className="text-2xl font-bold">パスワード変更</h1>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="flex items-start space-x-3">
                <FontAwesomeIcon icon={faInfoCircle} className="text-gray-500 text-xl mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    パスワードの設定がありません
                  </h3>
                  <p className="text-sm text-gray-800 mb-4">
                    あなたのアカウントは以下のソーシャルログインで認証されています。<br />
                    パスワードによるログインは設定されていません。
                  </p>
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">現在のログイン方法：</p>
                    {providers.map((providerId) => (
                      <div key={providerId} className="flex items-center space-x-2 bg-white rounded px-3 py-2">
                        {getProviderIcon(providerId)}
                        <span className="text-sm font-medium">{getProviderName(providerId)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={() => router.push('/')}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              PLAY TUNE STOREに戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // パスワードプロバイダーがある場合（通常のフォーム）
  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="space-y-6">
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold">パスワード変更</h1>
            <p className="text-[24px] text-gray-600">
              新しいパスワードを設定してください
            </p>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                </span>
                <Input
                  type="password"
                  placeholder="現在のパスワード"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  className="pl-12"
                />
              </div>
              
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
              
              <div className="my-4 p-4 bg-gray-50 text-sm text-gray-600 rounded border border-gray-200">
                このサイトはreCAPTCHAによって保護されており、Googleの
                <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>および
                <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">利用規約</a>が適用されます。
              </div>
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

            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-800 text-white"
              disabled={loading}
            >
              {loading ? 'お待ちください...' : 'パスワードを変更'}
            </Button>
          </form>

          <p className="text-[14px] text-center text-gray-600">
            <button
              onClick={() => router.push('/account')}
              className="text-gray-500 hover:underline font-bold" 
              disabled={loading}
            >
              アカウント設定に戻る
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}