'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, loginWithGoogle } from '@/lib/auth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faLock, faShield } from '@fortawesome/free-solid-svg-icons';
import { useGoogleReCaptcha } from '@/lib/recaptcha';
import { fetchCSRFToken } from '@/lib/csrf';

// ログイン試行を追跡するための状態
interface LoginAttempts {
  count: number;
  lockUntil?: number;
}

interface LoginModalProps {
  open?: boolean; // オプショナルに変更
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempts>({ count: 0 });
  const { executeRecaptcha } = useGoogleReCaptcha();
  const router = useRouter();

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

  // ログイン試行の回数を管理し、多すぎる場合はCAPTCHAを表示
  useEffect(() => {
    // ローカルストレージからログイン試行履歴を取得
    const storedAttempts = localStorage.getItem('loginAttempts');
    if (storedAttempts) {
      const attempts = JSON.parse(storedAttempts) as LoginAttempts;
      
      // ロックアウト期間が設定されている場合、それが過ぎているかチェック
      if (attempts.lockUntil && new Date().getTime() < attempts.lockUntil) {
        const remainingMinutes = Math.ceil(
          (attempts.lockUntil - new Date().getTime()) / (60 * 1000)
        );
        setError(`セキュリティのため、アカウントは${remainingMinutes}分間ロックされています。しばらく経ってからお試しください。`);
      } else if (attempts.lockUntil && new Date().getTime() >= attempts.lockUntil) {
        // ロックアウト期間が過ぎた場合はリセット
        setLoginAttempts({ count: 0 });
        localStorage.setItem('loginAttempts', JSON.stringify({ count: 0 }));
      } else {
        setLoginAttempts(attempts);
        // 3回以上の失敗でCAPTCHAを表示
        if (attempts.count >= 3) {
          setShowCaptcha(true);
        }
      }
    }
  }, []);

  const incrementLoginAttempts = () => {
    const newAttempts = { 
      count: loginAttempts.count + 1,
      // 5回以上失敗したら30分ロックアウト
      lockUntil: loginAttempts.count >= 4 ? new Date().getTime() + 30 * 60 * 1000 : undefined
    };
    setLoginAttempts(newAttempts);
    localStorage.setItem('loginAttempts', JSON.stringify(newAttempts));
    
    if (newAttempts.count >= 3) {
      setShowCaptcha(true);
    }
    
    if (newAttempts.lockUntil) {
      setError('セキュリティのため、アカウントは30分間ロックされました。しばらく経ってからお試しください。');
    }
  };

  const resetLoginAttempts = () => {
    setLoginAttempts({ count: 0 });
    localStorage.setItem('loginAttempts', JSON.stringify({ count: 0 }));
    setShowCaptcha(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // アカウントがロックされている場合
    if (loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil) {
      const remainingMinutes = Math.ceil(
        (loginAttempts.lockUntil - new Date().getTime()) / (60 * 1000)
      );
      setError(`セキュリティのため、アカウントは${remainingMinutes}分間ロックされています。しばらく経ってからお試しください。`);
      return;
    }
    
    if (!showPassword) {
      setShowPassword(true);
      return;
    }
    
    if (!identifier || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    
    // CSRF対策: トークンが取得できていない場合はエラー
    if (!csrfToken) {
      setError('セキュリティトークンが無効です。ページを再読み込みしてください。');
      return;
    }
    
    // CAPTCHA検証（必要な場合）
    let captchaToken = null;
    if (showCaptcha) {
      if (!executeRecaptcha) {
        setError('reCAPTCHAの読み込みに失敗しました。ページを再読み込みしてください。');
        return;
      }
      
      captchaToken = await executeRecaptcha('login');
      if (!captchaToken) {
        setError('セキュリティチェックに失敗しました。');
        return;
      }
    }
    
    try {
      setLoading(true);
      setError('');
      
      // CAPTCHAトークンとCSRFトークンを渡してログイン
      await login(identifier, password, {
        csrfToken,
        captchaToken: captchaToken || undefined
      });
      
      // ログイン成功したらログイン試行回数をリセット
      resetLoginAttempts();
      onLoginSuccess();
    } catch (error: any) {
      console.error("Login error:", error);
      
      // エラーメッセージを具体的に表示（ただしセキュリティ情報は漏らさない）
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else if (error.code === 'auth/too-many-requests') {
        setError('ログイン試行回数が多すぎます。しばらく経ってからお試しください。');
      } else if (error.code === 'auth/invalid-credential') {
        setError('認証情報が無効です。正しい情報を入力してください。');
      } else {
        setError('ログインに失敗しました。もう一度お試しください。');
      }
      
      // ログイン失敗したら試行回数を増やす
      incrementLoginAttempts();
      
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      
      await loginWithGoogle(csrfToken || undefined);
      
      // Google ログイン成功したらログイン試行回数をリセット
      resetLoginAttempts();
      onLoginSuccess();
    } catch (error: any) {
      console.error("Google login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        setError('ログインがキャンセルされました');
      } else {
        setError('Googleログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showPassword) {
      const passwordInput = document.getElementById('password-modal');
      if (passwordInput) {
        passwordInput.focus();
      }
    }
  }, [showPassword]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">PLAY TUNE IDへログイン</DialogTitle>
          <DialogDescription className="text-lg text-gray-600">
            {showPassword ? 'パスワードを入力してください' : 'メールアドレスを入力してください'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                <FontAwesomeIcon icon={faEnvelope} className="text-gray-400" />
              </span>
              <Input
                type="email"
                placeholder="メールアドレスを入力"
                className="pl-10"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={showPassword || loading}
                autoComplete="email"
              />
            </div>
            <div className={`transition-all duration-300 ease-in-out ${showPassword ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                  <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                </span>
                <Input
                  id="password-modal"
                  type="password"
                  placeholder="パスワード"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            {/* v3では明示的なCAPTCHAの表示は不要 */}
            {showCaptcha && showPassword && (
              <div className="my-4 p-4 bg-gray-50 text-sm text-gray-600 rounded border border-gray-200">
                このサイトはreCAPTCHAによって保護されており、Googleの
                <a href="https://policies.google.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">プライバシーポリシー</a>および
                <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">利用規約</a>が適用されます。
              </div>
            )}
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

          <Button
            type="submit"
            className="w-full bg-black hover:bg-gray-800 text-white"
            disabled={loading || !!(loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil)}
          >
            {loading ? 'お待ちください...' : showPassword ? 'ログイン' : '続行'}
          </Button>
          
          <div className="text-right">
            <button
              type="button"
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-gray-500 hover:underline"
            >
              パスワードをお忘れですか？
            </button>
          </div>
        </form>

        <div className="relative mt-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-[14px]">
            <span className="px-2 bg-white text-gray-500">または</span>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800"
            disabled={loading || !!(loginAttempts.lockUntil && new Date().getTime() < loginAttempts.lockUntil)}
          >
            <FontAwesomeIcon icon={faGoogle} className="mr-2" />
            <span>Googleで続ける</span>
          </Button>
        </div>

        <p className="text-[14px] text-center text-gray-600 mt-4">
          アカウントをお持ちでない方は{' '}
          <button
            onClick={() => router.push('/signup')}
            className="text-gray-500 hover:underline font-bold" 
            disabled={loading}
          >
            新規登録
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}