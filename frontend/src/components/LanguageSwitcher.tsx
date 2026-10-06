import React from 'react';
import { useI18n } from '../hooks/useI18n';
import { useStore } from '../contexts/StoreContext';

/**
 * Language switcher component that allows users to change the application language
 */
const LanguageSwitcher: React.FC = () => {
  const { t, currentLanguage, changeLanguage, availableLanguages } = useI18n();
  const { store, updateStore } = useStore();
  
  // Map of language codes to their display names
  const languageNames: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français'
  };
  
  const handleLanguageChange = (lang: string) => {
    // Change i18n language
    changeLanguage(lang);
    
    // Update store locale if needed
    if (store && store.localeCode) {
      const currentLocale = store.localeCode;
      const regionCode = currentLocale.includes('-') ? currentLocale.split('-')[1] : 'US';
      const newLocale = `${lang}-${regionCode}`;
      
      // Only update if it's different
      if (newLocale !== store.localeCode) {
        updateStore({
          ...store,
          localeCode: newLocale
        });
      }
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600 dark:text-muted-foreground">{t('language')}:</span>
      <div className="flex space-x-1">
        {availableLanguages.map(lang => (
          <button
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={`px-2 py-1 text-xs rounded ${
              currentLanguage === lang 
                ? 'bg-primary text-white' 
                : 'bg-gray-200 dark:bg-muted text-gray-700 dark:text-foreground hover:bg-gray-300'
            }`}
          >
            {languageNames[lang] || lang}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageSwitcher;
