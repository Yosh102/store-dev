// /src/components/store/wallet/WalletComponent.tsx
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCreditCard, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Check } from 'lucide-react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { config } from '@/lib/config';
import { useAuth } from '@/context/auth-context';
import CardSetupForm from './CardSetupForm';
import LoadingSpinner from '../../LoadingSpinner';
import { cn } from '@/lib/utils';

const stripePromise = loadStripe(config.stripe.publishableKey!);

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

// ✅ 新しいProps
interface WalletComponentProps {
  selectionMode?: boolean; // 選択モードかどうか
  selectedCardId?: string | null; // 選択されているカードID
  onCardSelect?: (cardId: string) => void; // カード選択時のコールバック
  onCardsLoaded?: (cards: PaymentMethod[]) => void; // カード読み込み完了時のコールバック
  showAddButton?: boolean; // 追加ボタンを表示するか（デフォルト: true）
}

// ✅ CSRF トークン取得関数
async function getCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get CSRF token');
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting CSRF token:', error);
    throw error;
  }
}

// ✅ カードブランドアイコンを取得する関数（AmEx/Diners追加）
function getCardBrandIcon(brand: string) {
  const brandLower = brand.toLowerCase();
  
  const iconMap: { [key: string]: string } = {
    visa: '/icons/visa.svg',
    mastercard: '/icons/mastercard.svg',
    jcb: '/icons/jcb.svg',
    unionpay: '/icons/unionpay.svg',
    amex: '/icons/americanexpress.svg',
    'american express': '/icons/americanexpress.svg',
    diners: '/icons/diners.svg',
    'diners club': '/icons/diners.svg',
  };

  return iconMap[brandLower] || null;
}

// ✅ カードブランド表示名を取得
function getCardBrandDisplayName(brand: string): string {
  const displayNames: { [key: string]: string } = {
    visa: 'VISA',
    mastercard: 'Mastercard',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    amex: 'American Express',
    diners: 'Diners Club',
    discover: 'Discover',
  };

  return displayNames[brand.toLowerCase()] || brand.toUpperCase();
}

export default function WalletComponent({
  selectionMode = false,
  selectedCardId = null,
  onCardSelect,
  onCardsLoaded,
  showAddButton = true,
}: WalletComponentProps = {}) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      createOrGetStripeCustomer();
    }
  }, [user]);

  useEffect(() => {
    if (stripeCustomerId) {
      fetchPaymentMethods();
    }
  }, [stripeCustomerId]);

  const createOrGetStripeCustomer = async () => {
    if (!user) return;

    try {
      const csrfToken = await getCSRFToken();
      
      // ✅ Firebase ID tokenを取得
      const auth = (await import('firebase/auth')).getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('認証トークンの取得に失敗しました');
      }

      const response = await fetch('/api/stripe/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // ✅ 認証ヘッダーを追加
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });

      if (response.ok) {
        const data = await response.json();
        setStripeCustomerId(data.customer.id);
      } else {
        const errorData = await response.json();
        console.error('Failed to create or get Stripe customer:', errorData);
        setError(errorData.error || errorData.message || 'Failed to create or get Stripe customer');
      }
    } catch (error) {
      console.error('Error creating or getting Stripe customer:', error);
      setError('Error creating or getting Stripe customer');
    }
  };

  const fetchPaymentMethods = async () => {
    if (!stripeCustomerId) return;

    setIsLoading(true);
    try {
      const csrfToken = await getCSRFToken();
      
      // ✅ Firebase ID tokenを取得
      const auth = (await import('firebase/auth')).getAuth();
      const idToken = await auth.currentUser?.getIdToken();

      const response = await fetch(`/api/stripe/payment-methods?customerId=${stripeCustomerId}`, {
        headers: {
          'Authorization': idToken ? `Bearer ${idToken}` : '', // ✅ 認証ヘッダーを追加
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods);
        
        // ✅ カード読み込み完了を通知
        if (onCardsLoaded) {
          onCardsLoaded(data.paymentMethods);
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch payment methods:', errorData);
        setError(errorData.error || errorData.message || 'Failed to fetch payment methods');
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setError('Error fetching payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!stripeCustomerId) return;

    setIsLoading(true);
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      
      // ✅ Firebase ID tokenを取得
      const auth = (await import('firebase/auth')).getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('認証トークンの取得に失敗しました');
      }

      const response = await fetch('/api/stripe/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // ✅ 認証ヘッダーを追加
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ customerId: stripeCustomerId }),
      });

      const data = await response.json();

      if (response.ok) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.error || data.message || '決済方法の追加に失敗しました。');
      }
    } catch (error) {
      console.error('Error setting up payment method:', error);
      setError('決済方法の追加中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const csrfToken = await getCSRFToken();
      
      // ✅ Firebase ID tokenを取得
      const auth = (await import('firebase/auth')).getAuth();
      const idToken = await auth.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('認証トークンの取得に失敗しました');
      }

      const response = await fetch('/api/stripe/delete-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // ✅ 認証ヘッダーを追加
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ paymentMethodId, customerId: stripeCustomerId }),
      });

      const data = await response.json();

      if (response.ok) {
        setPaymentMethods(data.paymentMethods);
        
        // ✅ カード更新を通知
        if (onCardsLoaded) {
          onCardsLoaded(data.paymentMethods);
        }
      } else {
        console.error('Failed to delete payment method:', data.error);
        setError(data.error || data.message || '決済方法の削除に失敗しました。');
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      setError('決済方法の削除中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSuccess = () => {
    setClientSecret(null);
    fetchPaymentMethods();
  };

  // ✅ カードクリック時の処理
  const handleCardClick = (cardId: string) => {
    if (selectionMode && onCardSelect) {
      onCardSelect(cardId);
    }
  };

  const options: StripeElementsOptions = {
    clientSecret: clientSecret ?? undefined,
    appearance: { theme: 'stripe' },
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      
      {/* ✅ カードがない場合のメッセージ（選択モード時） */}
      {selectionMode && paymentMethods.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faCreditCard} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-medium mb-1">
                まだカードが登録されていません
              </p>
              <p className="text-xs text-blue-700">
                下の「決済方法を追加」から登録できます
              </p>
            </div>
          </div>
        </div>
      )}
      
      {paymentMethods.map((method) => {
        const brandIcon = getCardBrandIcon(method.card.brand);
        const brandName = getCardBrandDisplayName(method.card.brand);
        const isSelected = selectionMode && selectedCardId === method.id;

        return (
          <Card 
            key={method.id} 
            className={cn(
              selectionMode ? "cursor-pointer" : "",
              "hover:bg-gray-50 transition-all",
              isSelected && "border-2 border-black"
            )}
            onClick={() => handleCardClick(method.id)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center flex-1">
                {/* ✅ ブランド別アイコンを表示 */}
                {brandIcon ? (
                  <div className="mr-3 w-10 h-6 relative flex items-center">
                    <Image
                      src={brandIcon}
                      alt={brandName}
                      width={40}
                      height={24}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <FontAwesomeIcon icon={faCreditCard} className="mr-3 text-gray-600" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">
                    {brandName} **** {method.card.last4}
                  </div>
                  <div className="text-xs text-gray-500">
                    有効期限: {method.card.exp_month}/{method.card.exp_year}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* ✅ 選択モード時のチェックマーク */}
                {selectionMode && isSelected && (
                  <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {/* ✅ 通常モード時の削除ボタン */}
                {!selectionMode && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePaymentMethod(method.id);
                    }}
                    variant="secondary"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      
      {/* ✅ 追加ボタン - CardSetupForm表示中は非表示 */}
      {showAddButton && !clientSecret && (
        <Button onClick={handleAddPaymentMethod} className="w-full bg-black hover:bg-gray-800 text-white">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          決済方法を追加
        </Button>
      )}
      
      {clientSecret && (
        <Elements stripe={stripePromise} options={options}>
          <CardSetupForm 
            onSetupSuccess={handleSetupSuccess} 
            clientSecret={clientSecret}
          />
        </Elements>
      )}
    </div>
  );
}

// ✅ Exportして他のコンポーネントで使えるようにする
export type { PaymentMethod };