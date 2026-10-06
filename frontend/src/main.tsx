import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Toaster } from 'react-hot-toast';

// Create a global error handler to catch any unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
  // You can add additional error reporting here if needed
});

// Add promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Dev-mode safeguard: if the tab was hidden for a while (e.g. computer slept),
// the Vite HMR WebSocket may be dead and the page can render blank. Reload
// automatically when the tab becomes visible again to re-establish HMR.
if (import.meta.env.DEV) {
  let hiddenAt: number | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt > 120000) {
      window.location.reload();
    }
  });
}

// Force default light mode: ensure no global 'dark' class is applied
try {
  const htmlEl = document.documentElement;
  if (htmlEl.classList.contains('dark')) {
    htmlEl.classList.remove('dark');
  }
} catch {
  // no-op: dark-mode class removal is best-effort
}

// Get the root element with error handling
const rootElement = document.getElementById('root');

// Error handling for React rendering
try {
  if (rootElement) {
    const root = createRoot(rootElement);
    
    root.render(
      <StrictMode>
        <App />
        <Toaster 
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            // Default options for all toasts
            className: '',
            duration: 5000,
            style: {
              background: '#363636', // Default background for general toasts
              color: '#fff',          // Default text color for general toasts
            },
            // Default options for specific types
            success: {
              duration: 3000,
              // iconTheme: { // Example if you want to customize the success icon colors
              //   primary: 'green',
              //   secondary: 'white',
              // },
              // To customize background/text for success, you might need to use a custom className or render a custom toast component
            },
            error: {
              duration: 4000,
              // style: { // Example: Custom style for error toasts
              //   background: 'red',
              //   color: 'white',
              // }
            }
          }}
          containerStyle={{
            top: 20,
            left: 20,
            bottom: 20,
            right: 20,
            zIndex: 9999, // High z-index to appear above modals
          }}
        />
      </StrictMode>
    );
  } else {
    console.error('Root element not found in the DOM');
    document.body.innerHTML = '<div style="padding: 20px; color: red;">Error: Root element with id "root" not found</div>';
  }
} catch (error) {
  console.error('Fatal error during React initialization:', error);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">React initialization error: ${error}</div>`;
}
