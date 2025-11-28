'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface GoogleReCaptchaContextProps {
  executeRecaptcha: ((action: string) => Promise<string | null>) | null;
  loaded: boolean;
}

const GoogleReCaptchaContext = createContext<GoogleReCaptchaContextProps>({
  executeRecaptcha: null,
  loaded: false
});

interface GoogleReCaptchaProviderProps {
  reCaptchaKey: string;
  children: React.ReactNode;
  scriptProps?: {
    nonce?: string;
    defer?: boolean;
    async?: boolean;
    appendTo?: 'head' | 'body';
    id?: string;
  };
}

export const GoogleReCaptchaProvider: React.FC<GoogleReCaptchaProviderProps> = ({ 
  reCaptchaKey, 
  children,
  scriptProps = {
    async: true,
    defer: true,
    appendTo: 'head',
    id: 'google-recaptcha-script'
  }
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // サーバーサイドレンダリング時は何もしない
    if (typeof window === 'undefined') {
      return;
    }

    // スクリプトがすでに読み込まれているか確認
    const existingScript = document.getElementById(
      scriptProps.id || 'google-recaptcha-script'
    );

    // grecaptchaがすでに利用可能な場合
    if (window.grecaptcha) {
      setLoaded(true);
      return;
    }
    
    // すでにスクリプトが存在する場合は新しく作成しない
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${reCaptchaKey}`;
    script.id = scriptProps.id || 'google-recaptcha-script';
    script.async = scriptProps.async !== false;
    script.defer = scriptProps.defer !== false;
    
    if (scriptProps.nonce) {
      script.nonce = scriptProps.nonce;
    }
    
    script.onload = () => {
      // console.log('reCAPTCHA script loaded successfully');
      setLoaded(true);
    };
    
    script.onerror = (e) => {
      // console.error('Error loading reCAPTCHA script', e);
      setError(new Error('Failed to load reCAPTCHA script'));
    };
    
    const target = scriptProps.appendTo === 'body' ? document.body : document.head;
    target.appendChild(script);
    
    return () => {
      // クリーンアップ時にスクリプトを削除する必要がある場合のみ
      // 多くの場合、グローバルスクリプトなので残しておく方が良い
      // target.removeChild(script);
    };
  }, [reCaptchaKey, scriptProps]);

  const executeRecaptcha = useCallback(async (action: string): Promise<string | null> => {
    if (!loaded || typeof window === 'undefined') {
      // console.warn('reCAPTCHA has not been loaded yet');
      return null;
    }
    
    if (!window.grecaptcha) {
      // console.error('grecaptcha not available');
      return null;
    }
    
    try {
      // grecaptcha.readyを使って初期化完了を待つ
      await new Promise<void>((resolve) => {
        window.grecaptcha.ready(() => resolve());
      });

      // トークンを取得
      const token = await window.grecaptcha.execute(reCaptchaKey, { action });
      
      if (!token) {
        // console.warn('Empty token received from reCAPTCHA');
        return null;
      }
      
      return token;
    } catch (error) {
      // console.error('reCAPTCHA execution error:', error);
      return null;
    }
  }, [reCaptchaKey, loaded]);

  // エラーが発生した場合はコンソールに出力するだけで、UIには何も表示しない
  useEffect(() => {
    if (error) {
      // console.error('reCAPTCHA error:', error.message);
    }
  }, [error]);

  return (
    <GoogleReCaptchaContext.Provider value={{ 
      executeRecaptcha: loaded ? executeRecaptcha : null,
      loaded 
    }}>
      {children}
    </GoogleReCaptchaContext.Provider>
  );
};

export const useGoogleReCaptcha = () => useContext(GoogleReCaptchaContext);

// window オブジェクトの型拡張
declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => Promise<void>;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}