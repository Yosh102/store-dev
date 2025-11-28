// src/components/store/wallet/CardSetupForm.tsx
import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';

interface CardSetupFormProps {
  onSetupSuccess: () => void;
  clientSecret: string;
}

export default function CardSetupForm({ onSetupSuccess, clientSecret }: CardSetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmSetup({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'An unknown error occurred');
      setIsLoading(false);
    } else {
      const { setupIntent, error } = await stripe.retrieveSetupIntent(clientSecret);
      if (error) {
        setError(error.message || 'An unknown error occurred');
        setIsLoading(false);
      } else {
        if (setupIntent.status === 'succeeded') {
          onSetupSuccess();
        } else {
          setError('Setup was not completed successfully. Please try again.');
          setIsLoading(false);
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-y-auto max-h-[50vh] pr-1">
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </form>
      </div>
      
      <div className="pt-4 mt-4 border-t">
        <Button
          type="submit"
          onClick={handleSubmit}
          disabled={!stripe || isLoading}
          className="w-full bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white rounded-full"
        >
          {isLoading ? '処理中' : '決済方法を追加する'}
        </Button>
      </div>
    </div>
  );
}