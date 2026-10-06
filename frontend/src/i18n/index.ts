import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import type { InitOptions, BackendModule, ReadCallback } from 'i18next';

// Track pending resource loads to prevent race conditions
let activeLoads: { [key: string]: boolean } = {};

// Custom backend plugin that handles errors and navigation interruptions
class SafeBackend {
  type = 'backend';

  init(): void {
    // No initialization needed
  }

  read(language: string, namespace: string, callback: ReadCallback): void {
    const loadKey = `${language}:${namespace}`;
    
    // Track this resource load
    activeLoads[loadKey] = true;
    
    // Use fetch directly with proper error handling
    const url = `/locales/${language}/${namespace}.json`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    fetch(url, {
      cache: 'default',
      signal: controller.signal,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        clearTimeout(timeoutId);
        // Remove from active loads once complete
        delete activeLoads[loadKey];
        
        // Always invoke the callback so i18next finishes loading the resource.
        // Ignoring the callback when the tab is hidden leaves i18next stuck and
        // can cause the UI to appear blank after the tab becomes visible again.
        callback(null, data);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        // Remove from active loads
        delete activeLoads[loadKey];
        
        console.warn(`Error loading i18n resource ${loadKey}:`, error);
        callback(null, {}); // Provide empty data instead of error to prevent crashes
      });
  }
}

// Add event listener for page visibility changes to clean up pending loads
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, possibly navigating away
    activeLoads = {}; // Clear tracking of active loads
  }
});

// Configuration with proper types
const initOptions: InitOptions = {
  // Fallback language
  fallbackLng: 'en',
  // Debug mode disabled to prevent console logs
  debug: false,
  // Namespaces for different parts of the application
  ns: ['common', 'dashboard', 'settings', 'products', 'orders', 'roles'],
  defaultNS: 'common',
  fallbackNS: ['common'],
  // Cache user language
  detection: {
    order: ['localStorage', 'cookie', 'navigator'],
    caches: ['localStorage'],
  },
  // Interpolation options
  interpolation: {
    escapeValue: false, // React already escapes variables
  },
  // React-specific settings
  react: {
    useSuspense: false, // Disable suspense to prevent issues with async loading
  },
  load: 'languageOnly', // Load only the base language (e.g., 'en' from 'en-US')
};

// Initialize i18next with optimized settings
i18n
  // Use our custom safe backend with proper type casting
  .use(new SafeBackend() as unknown as BackendModule)
  // Detect user language
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init(initOptions);

// Handle errors globally
i18n.on('failedLoading', (lng: string, ns: string, msg: string) => {
  console.warn(`i18n failed loading ${lng}:${ns} - ${msg}`);
});

export default i18n;
