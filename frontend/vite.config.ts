import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on mode (development, production, etc.)
  loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [] // Don't exclude any packages by default
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'), // Add path alias for easier imports
      'src': resolve(__dirname, './src') // Alias for src directory itself
    }
  },
  build: {
    chunkSizeWarningLimit: 1500, // Increase warning limit to 1500kb
    rollupOptions: {
      external: ['mysql2', 'mysql2/promise'], // Keep MySQL as external only for build
      output: {
        manualChunks: (id: string) => {
          // Split vendor libraries into separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n-vendor';
            }
            if (id.includes('html2canvas') || id.includes('dompurify')) {
              return 'printing-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            if (id.includes('date-fns')) {
              return 'date-vendor';
            }
          }
          
          // Split large application modules
          if (id.includes('src/services/discountService')) {
            return 'discount-service';
          }
          if (id.includes('src/services/printerService')) {
            return 'printer-service';
          }
        }
      }
    }
  },
  // Make sure environment variables are properly loaded
  define: {
    'process.env': {} // Allow accessing process.env for compatibility
  },
  // Improve development experience
  server: {
    open: true, // Open browser on server start
    hmr: {
      overlay: true // Show error overlay
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5172',
        changeOrigin: true,
        secure: false
      }
    }
  }
  };
});