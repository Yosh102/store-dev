'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, Currency, Settings } from '@/types/settings';

interface SettingsContextType {
  settings: Settings;
  setLanguage: (language: Language) => void;
  setCurrency: (currency: Currency) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    language: 'ja',
    currency: 'JPY',
  });

  const setLanguage = (language: Language) => {
    setSettings(prev => ({ ...prev, language }));
  };

  const setCurrency = (currency: Currency) => {
    setSettings(prev => ({ ...prev, currency }));
  };

  return (
    <SettingsContext.Provider value={{ settings, setLanguage, setCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

