'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { verifyEmail, sendVerificationEmail } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function VerifyEmail() {
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { user, firebaseUser } = useAuth(); // firebaseUserを使用
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.emailVerified) {
      router.push('/');
      return;
    }

    if (oobCode) {
      handleVerification(oobCode);
    }
  }, [user, oobCode, router]);

  const handleVerification = async (code: string) => {
    setIsVerifying(true);
    try {
      await verifyEmail(code);
      router.push('/');
    } catch (error) {
      setError('メール認証に失敗しました。リンクが無効か期限切れの可能性があります。');
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!firebaseUser) return; // FirebaseUserオブジェクトを使用
    
    try {
      setIsResending(true);
      await sendVerificationEmail(firebaseUser); // FirebaseUserオブジェクトを渡す
      setError('');
      alert('認証メールを再送信しました。');
    } catch (error) {
      setError('認証メールの再送信に失敗しました。');
    } finally {
      setIsResending(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-gray-600 mb-4" />
          <p className="text-gray-600">メールアドレスを認証中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-[480px] mx-auto">
        <div className="space-y-6">
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold"> {user?.email} 宛に認証メールを送信しました。<br />
            メール内のリンクをクリックして認証を完了してください。</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-[14px] text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="text-center">
              <Button
                onClick={handleResend}
                disabled={isResending}
                variant="secondary"
                className="text-[14px]"
              >
                <FontAwesomeIcon 
                  icon={isResending ? faSpinner : faEnvelope} 
                  className={`mr-2 ${isResending ? 'animate-spin' : ''}`}
                />
                認証メールを再送信
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}