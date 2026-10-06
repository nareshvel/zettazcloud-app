import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../contexts/StoreContext';
import { LANGUAGES, isRtl } from '@/data/localization/languages';

/**
 * Custom hook to integrate i18next with our store-based localization system
 * This ensures language settings are synced with the store settings
 */
export const useI18n = () => {
  const { t, i18n: i18nInstance, ready } = useTranslation();
  const { store } = useStore();
  const [currentLang, setCurrentLang] = useState(i18nInstance.language);
  const [isReady, setIsReady] = useState(ready);

  // Listen for language changes to trigger re-renders
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLang(lng);
      // Update document direction for RTL languages
      try {
        document.documentElement.setAttribute('dir', isRtl(lng) ? 'rtl' : 'ltr');
      } catch {
        /* no-op */
      }
    };
    
    i18nInstance.on('languageChanged', handleLanguageChanged);
    
    return () => {
      i18nInstance.off('languageChanged', handleLanguageChanged);
    };
  }, [i18nInstance]);
  
  // Track i18n ready state
  useEffect(() => {
    setIsReady(ready);
  }, [ready]);
  
  // When store locale changes, update i18n language
  useEffect(() => {
    // Extract language code from locale (e.g., 'en-US' -> 'en')
    if (store?.localeCode) {
      const languageCode = store.localeCode.split('-')[0];
      
      // Only change language if it's different from current
      if (i18nInstance.language !== languageCode) {
        i18nInstance.changeLanguage(languageCode);
      }
    }
  }, [store?.localeCode, i18nInstance]);
  
  // Typed version of t() function to ensure compatibility with React.
  // Wrapped in useCallback so consumers can safely use it in dependency arrays.
  const translate = useCallback((key: string, options?: Record<string, unknown>): string => {
    return t(key, options as Record<string, unknown>) as string;
  }, [t]);
  
  // Enhanced changeLanguage function
  const changeLanguage = (lang: string) => {
    // Update direction immediately
    try {
      document.documentElement.setAttribute('dir', isRtl(lang) ? 'rtl' : 'ltr');
    } catch {
      /* no-op */
    }
    return i18nInstance.changeLanguage(lang);
  };
  
  return {
    // Type-safe translation function
    t: translate,
    i18n: i18nInstance,
    
    // Helper to get current language code (e.g., 'en', 'es', 'fr')
    currentLanguage: currentLang,
    
    // Helper to change language
    changeLanguage,
    
    // List of available languages (codes)
    availableLanguages: LANGUAGES.map(l => l.code),
    
    // Translation ready state
    isReady
  };
};
