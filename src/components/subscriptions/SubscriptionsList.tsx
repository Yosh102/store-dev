'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, InfoIcon, CheckCircle2, ArrowRight, HelpCircle, CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
// プログレスバーをインポート
import { Progress } from '@/components/ui/progress';

type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete';

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface Subscription {
  groupId: string;
  groupName: string;
  groupImageUrl: string | null;
  subscriptionId: string;
  status: SubscriptionStatus;
  planType: 'monthly' | 'yearly';
  currentPeriodEnd: number;
  nextBillingDate: string;
  cancelAtPeriodEnd: boolean;
  coverImage?: string | null;
  description?: string | null;
  slug?: string;
  accentColor?: string;
  backgroundColor?: string;
  defaultPaymentMethod?: PaymentMethod | null;
}

// 解約理由の選択肢
const cancelReasons = [
  { id: 'too_expensive', label: '価格が高すぎる' },
  { id: 'not_enough_value', label: 'コンテンツが期待していたものと違う' },
  { id: 'missing_features', label: '必要な機能がない' },
  { id: 'temporary_break', label: '一時的に使用を中断する' },
  { id: 'other', label: 'その他' }
];

// 解約理由ごとのFAQ
const cancellationFAQs = {
  'too_expensive': [
    { question: '年間プランに切り替えると月々の料金は安くなりますか？', answer: 'はい、年間プランに切り替えるとお得になります。' },
    { question: 'お支払い方法を変更することはできますか？', answer: '現在、クレジットカードによる支払いに対応しています。ウォレットから変更可能です。' },
  ],
  'not_enough_value': [
    { question: 'コンテンツはどれくらいの頻度で更新されますか？', answer: '通常、週に2〜3回の頻度で新しいコンテンツを公開しています。' },
    { question: 'どのような特典がありますか？', answer: 'メンバー限定コンテンツ、限定グッズなどをご利用いただけます。' },
  ],
  'missing_features': [
    { question: '今後追加予定の機能はありますか？', answer: '現在、モバイルアプリの開発やコンテンツのダウンロード機能など、いくつかの新機能を開発中です。' },
    { question: '機能リクエストはできますか？', answer: 'はい、ぜひフィードバックフォームからご要望をお寄せください。メンバーからのフィードバックを基に定期的に機能を追加しています。' },
    { question: 'テクニカルサポートはどのように受けられますか？', answer: 'store@playtune.jp へメールをいただくか、サイト内のお問い合わせをご利用ください。３営業日以内に返信いたします。' }
  ],
  'temporary_break': [
    { question: '後で再開する場合、同じアカウントを使用できますか？', answer: 'はい、同じアカウントでいつでも再登録いただけます。' }
  ],
  'other': [
    { question: 'その他のご質問はありますか？', answer: 'お問い合わせフォームからご質問いただくか、store@playtune.jpまでメールでご連絡ください。' },
    { question: 'アカウントの削除方法を教えてください', answer: 'お問い合わせフォームからご質問いただくか、store@playtune.jpまでメールでご連絡ください。' }
  ]
};

export default function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  
  // 解約フロー用のステート
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [otherReason, setOtherReason] = useState<string>('');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showFinalDialog, setShowFinalDialog] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [faqExpanded, setFaqExpanded] = useState<string | null>(null); // FAQの開閉状態を管理
  
  // 支払い方法関連のステート
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [isPaymentUpdating, setIsPaymentUpdating] = useState(false);
  const [customerHasPaymentMethods, setCustomerHasPaymentMethods] = useState(false);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  // サブスクリプション情報を取得後、各グループの追加情報をFirestoreから取得
  const fetchGroupDetails = async (subscriptions: Subscription[]) => {
    try {
      const updatedSubscriptions = await Promise.all(
        subscriptions.map(async (subscription) => {
          // Firestoreからグループ情報を取得
          const groupDoc = await getDoc(doc(db, 'groups', subscription.groupId));
          
          if (groupDoc.exists()) {
            const groupData = groupDoc.data();
            return {
              ...subscription,
              coverImage: groupData.coverImage || null,
              description: groupData.description || null,
              slug: groupData.slug || null,
              accentColor: groupData.accentColor || '#000000',
              backgroundColor: groupData.backgroundColor || '#ffffff'
            };
          }
          
          return subscription;
        })
      );
      
      setSubscriptions(updatedSubscriptions);
    } catch (error) {
      console.error('Error fetching group details:', error);
    }
  };
  
  // FAQアコーディオンの開閉を切り替える
  const toggleFaqExpanded = (id: string) => {
    if (faqExpanded === id) {
      setFaqExpanded(null);
    } else {
      setFaqExpanded(id);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/stripe/get-subscriptions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サブスクリプション情報の取得に失敗しました');
      }
      
      const data = await response.json();
      
      // 初期データをセット
      setSubscriptions(data.subscriptions);
      
      // グループの追加情報を取得（カバー画像など）
      await fetchGroupDetails(data.subscriptions);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : 'サブスクリプション情報の取得に失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  // フィードバックを保存
  const saveCancellationFeedback = async (subscriptionId: string) => {
    try {
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      const userId = auth.currentUser?.uid;
      
      if (!userId) return;
      
      // フィードバックをFirestoreに保存
      await setDoc(doc(db, 'cancellation_feedback', `${userId}_${subscriptionId}`), {
        subscriptionId,
        userId,
        reason: cancelReason === 'other' ? otherReason : cancelReason,
        feedback: feedbackText,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error saving cancellation feedback:', error);
    }
  };

  // レンダリング用FAQコンポーネント
  const FaqAccordion = ({ faqItems, reason }: { faqItems: { question: string, answer: string }[], reason: string }) => {
    if (!faqItems || faqItems.length === 0) return null;
    
    return (
      <div className="mt-4 space-y-3">
        <h4 className="font-medium text-sm text-gray-900">よくある質問</h4>
        {faqItems.map((faq, index) => (
          <div key={`${reason}-faq-${index}`} className="border rounded-md overflow-hidden">
            <button
              className="flex justify-between items-center w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => toggleFaqExpanded(`${reason}-faq-${index}`)}
            >
              <span className="font-medium text-sm">{faq.question}</span>
              {faqExpanded === `${reason}-faq-${index}` ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {faqExpanded === `${reason}-faq-${index}` && (
              <div className="px-4 py-3 bg-white">
                <p className="text-sm text-gray-700">{faq.answer}</p>
                {index === 0 && (
                  <Button 
                    size="sm" 
                    variant="link" 
                    className="mt-2 text-blue-600 hover:text-blue-800 p-0"
                    onClick={() => {
                      resetCancellationState();
                      setCancelDialogOpen(false);
                    }}
                  >
                    解約をキャンセルして戻る
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    try {
      setActionLoading(subscriptionId);
      
      // フィードバックを保存
      await saveCancellationFeedback(subscriptionId);
      
      // 解約処理を実行
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          subscriptionId,
          cancelAtPeriodEnd: true,
          cancellationReason: cancelReason === 'other' ? otherReason : cancelReason,
          feedback: feedbackText
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サブスクリプションのキャンセルに失敗しました');
      }
      
      // 成功したら一覧を更新
      await fetchSubscriptions();
      
      // 解約完了ダイアログを表示
      setShowFinalDialog(true);
      resetCancellationState();
      
      toast({
        title: 'サブスクリプションをキャンセルしました',
        description: '現在の期間終了後、サブスクリプションは自動的に更新されません。',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : 'サブスクリプションのキャンセルに失敗しました',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateSubscription = async (subscriptionId: string) => {
    try {
      setActionLoading(subscriptionId);
      
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/stripe/reactivate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subscriptionId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サブスクリプションの再開に失敗しました');
      }
      
      // 成功したら一覧を更新
      await fetchSubscriptions();
      
      toast({
        title: 'サブスクリプションを再開しました',
        description: '自動更新が有効化されました。',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : 'サブスクリプションの再開に失敗しました',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // 解約フローを開始
  const startCancellationFlow = (subscription: Subscription) => {
    setCurrentSubscription(subscription);
    setCancelStep(1);
    setCancelReason('');
    setOtherReason('');
    setFeedbackText('');
    setConfirmCancel(false);
    setFaqExpanded(null);
    setCancelDialogOpen(true);
  };

  // 解約フローをリセット
  const resetCancellationState = () => {
    setCancelStep(1);
    setCancelReason('');
    setOtherReason('');
    setFeedbackText('');
    setConfirmCancel(false);
    setFaqExpanded(null);
    setCurrentSubscription(null);
  };

  // 次のステップへ進む
  const goToNextCancelStep = () => {
    setCancelStep(prev => prev + 1);
  };

  // 前のステップに戻る
  const goToPreviousCancelStep = () => {
    setCancelStep(prev => prev - 1);
  };

  // サブスクリプションのステータスに基づいた表示テキストを取得
  const getStatusDisplay = (status: SubscriptionStatus, cancelAtPeriodEnd: boolean) => {
    if (status === 'active' && cancelAtPeriodEnd) {
      return { 
        text: '期間終了後にキャンセル予定', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300' 
      };
    }
    
    switch (status) {
      case 'active':
        return { text: 'アクティブ', color: 'bg-green-100 text-green-800 border-green-300' };
      case 'canceled':
        return { text: 'キャンセル済み', color: 'bg-red-100 text-red-800 border-red-300' };
      case 'past_due':
        return { text: '支払い遅延', color: 'bg-orange-100 text-orange-800 border-orange-300' };
      case 'incomplete':
        return { text: '未完了', color: 'bg-gray-100 text-gray-800 border-gray-300' };
      default:
        return { text: status, color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    }).format(date);
  };

  // カード情報を表示用にフォーマット
  const formatPaymentMethod = (paymentMethod: PaymentMethod | null) => {
    if (!paymentMethod) return '登録されていません';
    
    const brandMap: { [key: string]: string } = {
      'visa': 'Visa',
      'mastercard': 'Mastercard',
      'amex': 'American Express',
      'jcb': 'JCB',
      'diners': 'Diners Club',
      'discover': 'Discover',
    };
    
    const brand = brandMap[paymentMethod.card.brand.toLowerCase()] || paymentMethod.card.brand.toUpperCase();
    return `${brand} **** ${paymentMethod.card.last4} (${paymentMethod.card.exp_month}/${paymentMethod.card.exp_year})`;
  };

  // 支払い方法変更フローを開始
  const handleOpenPaymentMethodDialog = async (subscription: Subscription) => {
    setCurrentSubscription(subscription);
    setSelectedPaymentMethod(subscription.defaultPaymentMethod?.id || '');
    setActionLoading(subscription.subscriptionId);
    
    try {
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      
      // サブスクリプションの詳細と利用可能な支払い方法を取得
      const response = await fetch(`/api/stripe/subscription-detail?subscriptionId=${subscription.subscriptionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'サブスクリプション詳細の取得に失敗しました');
      }
      
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
      setCustomerHasPaymentMethods(data.paymentMethods && data.paymentMethods.length > 0);
      
      // 現在の支払い方法が選択されるようにする
      if (data.subscription.default_payment_method) {
        setSelectedPaymentMethod(data.subscription.default_payment_method.id);
      }
      
      setPaymentDialogOpen(true);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : '支払い方法情報の取得に失敗しました',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // 支払い方法の変更を実行
  const handleUpdatePaymentMethod = async () => {
    if (!currentSubscription || !selectedPaymentMethod) return;
    
    setIsPaymentUpdating(true);
    
    try {
      // Firebaseの認証トークンを取得
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch('/api/stripe/update-subscription-payment-methods', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          subscriptionId: currentSubscription.subscriptionId,
          paymentMethodId: selectedPaymentMethod
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '支払い方法の更新に失敗しました');
      }
      
      // 成功したら一覧を更新
      await fetchSubscriptions();
      
      // ダイアログを閉じる
      setPaymentDialogOpen(false);
      
      toast({
        title: '支払い方法を更新しました',
        description: '次回の請求から新しい支払い方法が使用されます。',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'エラー',
        description: err instanceof Error ? err.message : '支払い方法の更新に失敗しました',
      });
    } finally {
      setIsPaymentUpdating(false);
    }
  };

  // 解約フローのステップコンテンツを取得
  const getCancellationStepContent = () => {
    switch (cancelStep) {
      case 1:
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">解約理由をお聞かせください</DialogTitle>
              <DialogDescription>
                サービス改善のため、解約を検討されている理由をお聞かせください。
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <RadioGroup value={cancelReason} onValueChange={setCancelReason}>
                {cancelReasons.map((reason) => (
                  <div key={reason.id} className="flex items-center space-x-2 py-1">
                    <RadioGroupItem value={reason.id} id={reason.id} />
                    <Label htmlFor={reason.id} className="cursor-pointer">{reason.label}</Label>
                  </div>
                ))}
              </RadioGroup>
              
              {cancelReason === 'other' && (
                <div className="mt-2 space-y-2">
                  <Label htmlFor="other-reason">その他の理由を教えてください</Label>
                  <Textarea 
                    id="other-reason" 
                    placeholder="解約理由を詳しく教えてください" 
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                  />
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={goToNextCancelStep}
                disabled={!cancelReason || (cancelReason === 'other' && !otherReason)}
              >
                次へ <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        );
        
      case 2:
        // 選択された理由に基づいてFAQを表示
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">ご不便をおかけしております</DialogTitle>
              <DialogDescription>
                選択いただいた理由に基づいて、解決策をご提案いたします。
                以下のFAQが、問題の解決に役立つかもしれません。
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-2">
              {cancelReason && cancellationFAQs[cancelReason as keyof typeof cancellationFAQs] && (
                <FaqAccordion 
                  faqItems={cancellationFAQs[cancelReason as keyof typeof cancellationFAQs]} 
                  reason={cancelReason}
                />
              )}
              
              <div className="mt-6 border-t pt-4">
                <p className="text-sm text-gray-600 mb-2">
                  FAQで問題が解決しない場合は、引き続き解約手続きを進めることができます。
                </p>
                <p className="text-sm text-gray-600">
                  またはカスタマーサポート（store@playtune.jp）にお問い合わせください。
                </p>
              </div>
            </div>
            
            <DialogFooter>
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  onClick={goToPreviousCancelStep}
                >
                  戻る
                </Button>
                <Button
                  onClick={goToNextCancelStep}
                >
                  解約手続きを続ける <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">ご意見・ご要望をお聞かせください</DialogTitle>
              <DialogDescription>
                よりよいサービスを提供するために、ご意見・ご要望をお聞かせください。
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <Textarea 
                placeholder="ご意見・ご要望がありましたらご記入ください"
                rows={5}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
              />
            </div>
            
            <DialogFooter>
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  onClick={goToPreviousCancelStep}
                >
                  戻る
                </Button>
                <Button
                  onClick={goToNextCancelStep}
                >
                  次へ <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </DialogFooter>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl">最終確認</DialogTitle>
              <DialogDescription>
                <p>サブスクリプションを解約します。現在の期間が終了するまではサービスをご利用いただけます。</p>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-4 bg-gray-50">
                <h4 className="font-medium mb-2">サブスクリプション情報</h4>
                <p className="text-sm">グループ名: {currentSubscription?.groupName}</p>
                <p className="text-sm">プラン: {currentSubscription?.planType === 'monthly' ? '月額' : '年額'}メンバーシップ</p>
                <p className="text-sm">次回請求日: {currentSubscription?.nextBillingDate ? formatDate(currentSubscription.nextBillingDate) : '-'}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-start space-x-2">
                  <Checkbox 
                    id="confirm-cancel" 
                    checked={confirmCancel}
                    onCheckedChange={(checked) => setConfirmCancel(checked as boolean)}
                  />
                  <Label htmlFor="confirm-cancel" className="text-sm">
                    本当に解約します。この操作は取り消せません。
                  </Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <div className="flex justify-between w-full">
                <Button
                  variant="outline"
                  onClick={goToPreviousCancelStep}
                >
                  戻る
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => currentSubscription && handleCancelSubscription(currentSubscription.subscriptionId)}
                  disabled={!confirmCancel || actionLoading === currentSubscription?.subscriptionId}
                >
                  {actionLoading === currentSubscription?.subscriptionId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : '解約を確定する'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        );
        
      default:
        return null;
    }
  };

  // 進捗バーの表示
  const CancellationProgressBar = () => {
    const progress = (cancelStep / 4) * 100;
    
    return (
      <div className="w-full space-y-2 mb-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>解約理由</span>
          <span>解決策</span>
          <span>フィードバック</span>
          <span>確認</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border shadow-sm overflow-hidden">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-[180px]" />
                  <Skeleton className="h-4 w-[120px]" />
                </div>
                <div className="ml-auto">
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-[140px]" />
                  <Skeleton className="h-4 w-[120px]" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-[160px]" />
                </div>
              </div>
            </div>
            <div className="bg-muted/50 px-6 py-4">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>エラーが発生しました</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          <Button 
            onClick={fetchSubscriptions}
            className="mt-4"
            variant="outline"
            size="sm"
          >
            再読み込み
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>サブスクリプションはありません</AlertTitle>
        <AlertDescription>
          現在アクティブなサブスクリプションはありません。ファンクラブに参加すると、ここで管理できるようになります。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6">
      {subscriptions.map((subscription) => {
        const statusDisplay = getStatusDisplay(subscription.status, subscription.cancelAtPeriodEnd);
        const isActive = subscription.status === 'active';
        const isActiveButCanceling = isActive && subscription.cancelAtPeriodEnd;
        
        return (
          <Card key={subscription.subscriptionId} className="overflow-hidden border-gray-200 hover:shadow-md transition-shadow">
            <div className="px-4 py-4 sm:px-6">
              {/* モバイル表示 */}
              <div className="flex flex-col gap-4 md:hidden">
                <div className="flex items-center">
                  <Avatar className="h-12 w-12 rounded-full border border-gray-200">
                    {subscription.coverImage ? (
                      <AvatarImage src={subscription.coverImage} alt={subscription.groupName} className="object-cover" />
                    ) : subscription.groupImageUrl ? (
                      <AvatarImage src={subscription.groupImageUrl} alt={subscription.groupName} className="object-cover" />
                    ) : (
                      <AvatarFallback className="text-lg">{subscription.groupName.slice(0, 2)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="ml-3">
                    <h3 className="text-base font-semibold">{subscription.groupName}</h3>
                    <span className="text-sm text-muted-foreground">
                      {subscription.planType === 'monthly' ? '月額メンバーシップ' : '年額メンバーシップ'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Badge className={`${statusDisplay.color} font-medium inline-block`}>
                      {statusDisplay.text}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      次回請求日: {formatDate(subscription.nextBillingDate)}
                    </p>
                  </div>
                  
                  <div>
                    {isActive && !subscription.cancelAtPeriodEnd && (
                      <Button 
                        variant="outline" 
                        className="border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-600 text-xs font-light"
                        onClick={() => startCancellationFlow(subscription)}
                        disabled={!!actionLoading}
                        size="sm"
                      >
                        {actionLoading === subscription.subscriptionId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            処理中...
                          </>
                        ) : '解約する'}
                      </Button>
                    )}
                    
                    {isActive && subscription.cancelAtPeriodEnd && (
                      <Button 
                        variant="outline" 
                        className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleReactivateSubscription(subscription.subscriptionId)}
                        disabled={!!actionLoading}
                        size="sm"
                      >
                        {actionLoading === subscription.subscriptionId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            処理中...
                          </>
                        ) : '解約をキャンセルする'}
                      </Button>
                    )}
                    
                    {!isActive && (
                      <Button 
                        variant="outline" 
                        disabled={true}
                        size="sm"
                      >
                        再購入
                      </Button>
                    )}
                  </div>
                </div>

                {/* 支払い方法情報（モバイル） */}
                <div className="flex justify-between items-center py-1 bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm text-gray-500">支払い方法</span>
                  </div>
                  <div className="text-sm">
                    {formatPaymentMethod(subscription.defaultPaymentMethod || null)}
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    onClick={() => handleOpenPaymentMethodDialog(subscription)}
                    disabled={!!actionLoading}
                  >
                    {actionLoading === subscription.subscriptionId ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="mr-2 h-4 w-4" />
                    )}
                    支払い方法を変更
                  </Button>
                </div>
                
                {isActiveButCanceling && (
                  <div className="bg-yellow-50 px-3 py-2 rounded-md text-sm">
                    <span className="text-yellow-700 font-medium">
                      このメンバーシップは {formatDate(subscription.nextBillingDate)} をもって自動更新を停止します
                    </span>
                  </div>
                )}
              </div>
              
              {/* デスクトップ表示 */}
              <div className="hidden md:flex md:items-center">
                <div className="flex-1 flex justify-center">
                  <div className="flex items-center">
                    <Avatar className="h-14 w-14 rounded-full border border-gray-200">
                      {subscription.coverImage ? (
                        <AvatarImage src={subscription.coverImage} alt={subscription.groupName} className="object-cover" />
                      ) : subscription.groupImageUrl ? (
                        <AvatarImage src={subscription.groupImageUrl} alt={subscription.groupName} className="object-cover" />
                      ) : (
                        <AvatarFallback className="text-lg">{subscription.groupName.slice(0, 2)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-base font-semibold">{subscription.groupName}</h3>
                        <span className="text-sm text-muted-foreground ml-2">
                          {subscription.planType === 'monthly' ? '月額メンバーシップ' : '年額メンバーシップ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="mr-6">
                    <Badge className={`${statusDisplay.color} font-medium`}>
                      {statusDisplay.text}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      次回請求日: {formatDate(subscription.nextBillingDate)}
                    </p>
                  </div>
                  
                  <div>
                    {isActive && !subscription.cancelAtPeriodEnd && (
                      <Button 
                        variant="outline" 
                        className="border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => startCancellationFlow(subscription)}
                        disabled={!!actionLoading}
                        size="sm"
                      >
                        {actionLoading === subscription.subscriptionId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            処理中...
                          </>
                        ) : '解約する'}
                      </Button>
                    )}
                    
                    {isActive && subscription.cancelAtPeriodEnd && (
                      <Button 
                        variant="outline" 
                        className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                        onClick={() => handleReactivateSubscription(subscription.subscriptionId)}
                        disabled={!!actionLoading}
                        size="sm"
                      >
                        {actionLoading === subscription.subscriptionId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            処理中...
                          </>
                        ) : '解約をキャンセルする'}
                      </Button>
                    )}
                    
                    {!isActive && (
                      <Button 
                        variant="outline" 
                        disabled={true}
                        size="sm"
                      >
                        再購入するには新しいプランが必要です
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 支払い方法情報（デスクトップ） */}
              <div className="hidden md:block mt-4">
                <div className="flex justify-between items-center py-2 bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center">
                    <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-sm font-medium">支払い方法</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm mr-4">
                      {formatPaymentMethod(subscription.defaultPaymentMethod || null)}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => handleOpenPaymentMethodDialog(subscription)}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === subscription.subscriptionId ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      変更
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* デスクトップでのキャンセル通知 */}
              {isActiveButCanceling && (
                <div className="hidden md:flex md:justify-center">
                  <div className="bg-yellow-50 px-3 py-2 rounded-md text-sm mt-3 max-w-md">
                    <span className="text-yellow-700 font-medium">
                      このメンバーシップは {formatDate(subscription.nextBillingDate)} をもって自動更新を停止します
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}
      
      {/* 解約プロセスのダイアログ */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md md:max-w-lg">
          <CancellationProgressBar />
          {getCancellationStepContent()}
        </DialogContent>
      </Dialog>
      
      {/* 支払い方法変更ダイアログ */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>支払い方法の変更</DialogTitle>
            <DialogDescription>
              {currentSubscription?.groupName}の支払い方法を変更します。
              次回の請求から新しい支払い方法が使用されます。
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {!customerHasPaymentMethods ? (
              <div className="text-center py-4">
                <AlertCircle className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <p className="text-sm text-gray-700 mb-4">登録済みの支払い方法がありません。</p>
                <Button
                  onClick={() => {
                    // 支払い方法追加画面へ遷移
                    setPaymentDialogOpen(false);
                    window.location.href = '/wallet';
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  支払い方法を追加する
                </Button>
              </div>
            ) : (
              <>
                <RadioGroup 
                  value={selectedPaymentMethod} 
                  onValueChange={setSelectedPaymentMethod}
                  className="space-y-3"
                >
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center space-x-2 border p-3 rounded-md">
                      <RadioGroupItem value={method.id} id={method.id} />
                      <Label htmlFor={method.id} className="flex-1 flex items-center cursor-pointer">
                        <CreditCard className="mr-2 h-4 w-4 text-gray-400" />
                        <span>
                          {method.card.brand.toUpperCase()} **** {method.card.last4}
                        </span>
                        <span className="ml-auto text-sm text-gray-500">
                          {method.card.exp_month}/{method.card.exp_year}
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                
                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      // 支払い方法追加画面へ遷移
                      setPaymentDialogOpen(false);
                      window.location.href = '/wallet';
                    }}
                    disabled={isPaymentUpdating}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    支払い方法を追加
                  </Button>
                  
                  <Button
                    onClick={handleUpdatePaymentMethod}
                    disabled={isPaymentUpdating || !selectedPaymentMethod}
                  >
                    {isPaymentUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      '変更を保存'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* 解約完了ダイアログ */}
      <Dialog open={showFinalDialog} onOpenChange={setShowFinalDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">解約手続きが完了しました</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <p className="mb-2">
              {currentSubscription?.groupName}の解約手続きが完了しました。
            </p>
            <p className="text-sm text-muted-foreground">
              現在の期間終了日（{currentSubscription?.nextBillingDate ? formatDate(currentSubscription.nextBillingDate) : ''}）までは引き続きサービスをご利用いただけます。
            </p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowFinalDialog(false)}
              className="w-full"
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}