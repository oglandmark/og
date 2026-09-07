import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import { getTranslation, type Lang, type TranslationKey } from '@/lib/i18n';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
  tr: (key: TranslationKey) => string;
  isRTL: boolean;
  hasSelectedLanguage: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LANG_KEY = '@og-landmark/language-v1';
const LANG_SELECTED_KEY = '@og-landmark/language-selected-v1';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(true); // default English — no language gate on first launch
  const [isLoading, setIsLoading] = useState(true);
  const [storageTimedOut, setStorageTimedOut] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(LANG_KEY),
      AsyncStorage.getItem(LANG_SELECTED_KEY),
    ])
      .then(([savedLang, selected]) => {
        if (savedLang === 'en' || savedLang === 'ur') setLangState(savedLang);
        if (selected === 'true') setHasSelectedLanguage(true);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const timeout = setTimeout(() => setStorageTimedOut(true), 1800);
    return () => clearTimeout(timeout);
  }, []);

  const setLang = useCallback(async (newLang: Lang) => {
    setLangState(newLang);
    setHasSelectedLanguage(true);
    // Direction is also applied by the root view for an immediate update.
    // Keeping I18nManager in sync makes native text/layout direction correct
    // after the next app start without forcing a disruptive reload here.
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(newLang === 'ur');
    await Promise.all([
      AsyncStorage.setItem(LANG_KEY, newLang),
      AsyncStorage.setItem(LANG_SELECTED_KEY, 'true'),
    ]).catch(() => undefined);
  }, []);

  const tr = useCallback(
    (key: TranslationKey): string => getTranslation(lang, key),
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, tr, isRTL: lang === 'ur', hasSelectedLanguage }),
    [lang, setLang, tr, hasSelectedLanguage],
  );

  if (isLoading && !storageTimedOut) return null;

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
