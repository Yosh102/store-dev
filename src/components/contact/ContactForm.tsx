'use client';

import { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createZendeskTicket } from '@/lib/zendesk';
import { useGoogleReCaptcha } from '@/lib/recaptcha';
import Link from 'next/link';

export default function ContactForm() {
  const { user } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const _name = name.trim();
    const _email = email.trim();
    const _message = message.trim();

    if (!_name || !_email || !_message) {
      setErrorMessage('全ての項目を入力してください。');
      return;
    }

    // 確認画面へ
    setShowConfirmation(true);
    setErrorMessage('');
  };
const handleConfirmSubmit = async () => {
  setIsSubmitting(true);
  setSubmitStatus('idle');
  setErrorMessage('');

  try {
    const _name = name.trim();
    const _email = email.trim();
    const _message = message.trim();

    // reCAPTCHA（完全ガード）
    let captchaToken: string | undefined;
    try {
      if (executeRecaptcha) {
        const token = await executeRecaptcha('contact_form');
        if (token) captchaToken = token;
      } else {
        console.warn('reCAPTCHA not ready; continue without token');
      }
    } catch (e) {
      console.warn('reCAPTCHA execution failed:', e ?? '(no reason)');
      // 必要ならここで return して送信中断
    }

    await createZendeskTicket(_name, _email, _message, captchaToken);

    setSubmitStatus('success');
    setMessage('');
    setShowConfirmation(false);
  } catch (error) {
    console.error('Error submitting ticket:', error ?? '(no reason)');
    setSubmitStatus('error');
    setErrorMessage(
      error instanceof Error
        ? error.message
        : 'お問い合わせの送信中にエラーが発生しました。'
    );
    setShowConfirmation(false);
  } finally {
    setIsSubmitting(false);
  }
};

  const handleBackToEdit = () => {
    setShowConfirmation(false);
    setErrorMessage('');
  };

  return (
    <>
      {showConfirmation ? (
        // 確認画面
        <div className="w-full max-w-[480px] mx-auto">
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">送信内容の確認</h2>

            <div className="space-y-4 bg-white rounded-lg p-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">お名前</div>
                <div className="font-medium">{name}</div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">メールアドレス</div>
                <div className="font-medium">{email}</div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">お問い合わせ内容</div>
                <div className="font-medium whitespace-pre-wrap">{message}</div>
              </div>
            </div>

            {/* reCAPTCHA 注意書き（リンクの開始タグを修正） */}
            <div className="text-xs text-gray-600 bg-white rounded p-3 border border-gray-200 leading-relaxed">
              このサイトは reCAPTCHA によって保護されており、Google の
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

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={handleBackToEdit}
                disabled={isSubmitting}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-black"
              >
                戻る
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex-1 bg-black hover:bg-gray-800 text-white"
              >
                {isSubmitting ? '送信中...' : '送信する'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // 入力画面
        <div className="w-full max-w-[480px] mx-auto">
          {!user && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6 shadow-[0_20px_80px_rgba(0,0,0,0.18)]">
              <p className="text-black font-bold text-center mb-4">
                PLAY TUNE IDにログインしていただくことで
                <br />
                よりスムーズにご案内可能です
              </p>
              <Link href="/login?redirect=%2Fcontact" className="block">
                <Button
                  type="button"
                  className="w-full bg-white hover:bg-gray-100 text-black font-bold border-2 border-gray-100 shadow-none"
                >
                  PLAY TUNE IDへログインする
                </Button>
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-lg">お名前</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-lg">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
              />
            </div>
            <div>
              <Label htmlFor="message" className="text-lg">お問い合わせ内容</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={1000}
                className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg h-32 resize-none"
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-black hover:bg-gray-800 text-white"
            >
              確認画面へ
            </Button>

            {submitStatus === 'success' && (
              <p className="text-green-600">
                お問い合わせを受け付けました。担当者からの返信をお待ちください。
              </p>
            )}
            {submitStatus === 'error' && (
              <p className="text-red-600">
                {errorMessage || '送信に失敗しました。しばらくしてからもう一度お試しください。'}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
