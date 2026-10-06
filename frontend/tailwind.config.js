const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"], // Ensure this is 'class' for manual dark mode toggling
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Enhanced navy blue primary palette
                primary: {
                    DEFAULT: 'hsl(var(--primary))', // Your existing primary (226 85% 17%)
                    foreground: 'hsl(var(--primary-foreground))',
                    // Additional navy blue variations for more flexibility
                    // True navy scale, anchored on --primary (226 85% 17% = #08145a).
                    // NOTE: these were previously indigo/violet (#6366f1 etc.) which made
                    // buttons/headers read as light blue-purple. Keep this scale navy so
                    // primary-* always matches the brand.
                    50:  '#eef1f9',  // Very light navy tint
                    100: '#d5dcf0',  // Light navy tint
                    200: '#adbae1',  // Lighter navy
                    300: '#8497d2',  // Light navy
                    400: '#5c74c3',  // Medium navy
                    500: '#3a53a8',  // Base navy
                    600: '#2b3f85',  // Navy
                    700: '#1d2c62',  // Darker navy
                    800: '#111d45',  // Much darker navy
                    900: '#08145a',  // Brand navy (matches --primary)
                    950: '#050d3a',  // Ultra dark navy
                    // Legacy aliases kept for compatibility
                    hover: '#111d45',    // Darker navy for hover (use primary-800)
                    light: '#eef1f9',    // Very light navy for backgrounds (use primary-50)
                    dark: '#050d3a',     // Ultra dark navy (use primary-950)
                },
                // Keep your existing secondary structure
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))', // Now uses HSL variable
                    foreground: 'hsl(var(--secondary-foreground))',
                    // Add some warm gray variations that complement navy
                    50: '#fafaf9',
                    100: '#f5f5f4',
                    200: '#e7e5e4',
                    300: '#d6d3d1',
                    400: '#a8a29e',
                    500: '#78716c',
                    600: '#57534e',
                    700: '#44403c',
                    800: '#292524',
                    900: '#1c1917',
                    hover: '#57534e', // Consider using secondary-600
                    light: '#fafaf9', // Consider using secondary-50
                    dark: '#292524', // Consider using secondary-800
                },
                // Keep all your existing shadcn/ui colors intact (these are correctly handled by HSL vars)
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                // Keep your existing text colors but add navy-compatible ones
                text: {
                    // DEFAULT: '#1F2937', // Consider using 'foreground' directly instead
                    // secondary: '#6B7280', // Consider using 'muted-foreground' directly instead
                    placeholder: '#9CA3AF',
                    onPrimary: '#FFFFFF',
                    onDark: '#FFFFFF',
                    onNavy: '#FFFFFF'  // Specifically for navy backgrounds
                },
                // Enhanced status colors that work well with navy
                success: {
                    DEFAULT: '#10B981',
                    light: '#D1FAE5',
                    text: '#065F46',
                    50: '#ecfdf5',
                    500: '#10b981',
                    600: '#059669'
                },
                warning: {
                    DEFAULT: '#F59E0B',
                    light: '#FFFBEB',
                    text: '#B45309',
                    50: '#fffbeb',
                    500: '#f59e0b',
                    600: '#d97706'
                },
                danger: {
                    DEFAULT: '#EF4444',
                    light: '#FEE2E2',
                    text: '#991B1B',
                    50: '#fef2f2',
                    500: '#ef4444',
                    600: '#dc2626'
                },
                // Beautiful page and modal backgrounds
                page: {
                    'light': '#fafbfc',        // Subtle off-white
                    'warm': '#fef7f0',         // Warm cream
                    'cool': '#f8fafc',         // Cool light gray
                    'navy-light': '#f0f4ff',   // Very light navy tint
                    'gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Gradient option
                },
                modal: {
                    'overlay': 'rgba(0, 0, 0, 0.6)',           // Dark overlay
                    'overlay-light': 'rgba(0, 0, 0, 0.4)',     // Lighter overlay
                    'overlay-navy': 'rgba(30, 58, 138, 0.3)',  // Navy tinted overlay
                    'glass': 'rgba(255, 255, 255, 0.95)',      // Glass morphism
                    'glass-dark': 'rgba(17, 24, 39, 0.95)',    // Dark glass
                },
            },
            // Enhanced font family (keeping Inter as primary)
            fontFamily: {
                sans: ['Inter var', 'Inter', ...defaultTheme.fontFamily.sans],
                display: ['Inter var', 'Inter', ...defaultTheme.fontFamily.sans]
            },
            // Professional shadow system that complements navy
            boxShadow: {
                // Keep your existing shadows
                sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                inner: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)',
                none: 'none',
                sidebar: '2px 0 10px -3px rgba(0, 0, 0, 0.06), 1px 0 6px -3px rgba(0,0,0,0.05)',
                topbar: '0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                card: '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 8px -2px rgba(0, 0, 0, 0.1)',
                modal: '0px 8px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 8px -4px rgba(0, 0, 0, 0.07)',
                // New professional shadows
                'navy-glow': '0 0 20px rgba(67, 56, 202, 0.15)',        // Navy glow effect
                'elegant': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 20px 40px -5px rgba(0, 0, 0, 0.04)',
                'floating': '0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 16px 30px -5px rgba(0, 0, 0, 0.07)',
                'button': '0 4px 14px 0 rgba(67, 56, 202, 0.15)',       // Button shadow with navy tint
            },
            // Enhanced border radius (keeping your existing radius variable)
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
                // Additional professional radius options
                xl: '0.75rem',
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            // Professional animations
            animation: {
                'pulse-stock': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Your existing animation
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'navy-glow': 'navyGlow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                // Your existing pulse animation is already in CSS
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' }
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                },
                navyGlow: {
                    '0%': { boxShadow: '0 0 20px rgba(67, 56, 202, 0.15)' },
                    '100%': { boxShadow: '0 0 30px rgba(67, 56, 202, 0.25)' }
                }
            }
        }
    },
    plugins: [
        require('@tailwindcss/forms'),
        require("tailwindcss-animate"),
        // Custom plugin to automatically style common elements
        function({ addComponents, theme }) {
            addComponents({
                // Enhanced button styles
                '.btn-primary': {
                    '@apply bg-primary-700 hover:bg-primary-800 active:bg-primary-900 text-white font-semibold px-6 py-3 rounded-lg shadow-button hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02]': {},
                },
                '.btn-secondary': {
                    '@apply bg-secondary-100 hover:bg-secondary-200 text-secondary-800 font-semibold px-6 py-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200': {},
                },
                '.btn-success': {
                    '@apply bg-success-500 hover:bg-success-600 text-white font-semibold px-6 py-3 rounded-lg shadow-button hover:shadow-lg transition-all duration-200': {},
                },
                '.btn-danger': {
                    '@apply bg-danger-500 hover:bg-danger-600 text-white font-semibold px-6 py-3 rounded-lg shadow-button hover:shadow-lg transition-all duration-200': {},
                },
                
                // Enhanced modal styles
                '.modal-overlay': {
                    // Use a dynamic overlay color that can adapt to dark mode
                    '@apply fixed inset-0 bg-modal-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4': {},
                },
                '.modal-content': {
                    // Use background and foreground which are theme-aware
                    '@apply bg-card text-card-foreground rounded-2xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-hidden animate-slide-up': {},
                },
                '.modal-header': {
                    // You might want to make this more theme-aware or use primary-950 for dark mode
                    '@apply bg-primary-800 text-white px-6 py-4 shadow-navy-glow': {},
                },
                '.modal-body': {
                    '@apply p-6 overflow-y-auto': {},
                },
                '.modal-footer': {
                    // Use base-200/base-300 from DaisyUI or muted colors
                    '@apply px-6 py-4 bg-muted border-t border-border flex justify-end gap-3': {},
                },
                
                // Enhanced card styles
                '.card-elegant': {
                    '@apply bg-card text-foreground rounded-xl shadow-elegant border border-border overflow-hidden': {},
                },
                '.card-navy': {
                    '@apply bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-xl shadow-lg': {},
                },
                
                // Navigation styles
                '.nav-primary': {
                    '@apply bg-primary-800 shadow-topbar': {}, // Consider making this theme-aware with HSL vars
                },
                '.nav-item': {
                    '@apply text-primary-100 hover:text-white hover:bg-primary-700 px-4 py-2 rounded-lg transition-all duration-200': {},
                },
                '.nav-item-active': {
                    '@apply text-white bg-primary-600 px-4 py-2 rounded-lg shadow-sm': {},
                },
                
                // Form styles
                '.form-input': {
                    // Use input/border HSL variables for theme awareness
                    '@apply border-input rounded-lg shadow-sm focus:border-primary focus:ring-ring focus:ring-2 focus:ring-opacity-25 transition-all duration-200 bg-background text-foreground': {},
                },
                '.form-label': {
                    // Use foreground/muted-foreground
                    '@apply text-sm font-semibold text-foreground mb-2 block': {},
                },
            })
        }
    ],
};