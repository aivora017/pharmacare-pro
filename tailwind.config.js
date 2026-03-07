/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PharmaCare Pro brand colours
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',  // Primary brand colour
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Status colours (consistent across all screens)
        success:  { DEFAULT: '#16a34a', light: '#dcfce7', dark: '#166534' },
        warning:  { DEFAULT: '#d97706', light: '#fef3c7', dark: '#92400e' },
        danger:   { DEFAULT: '#dc2626', light: '#fee2e2', dark: '#991b1b' },
        info:     { DEFAULT: '#0284c7', light: '#e0f2fe', dark: '#075985' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Custom sizes for pharmacy context
        'bill':  ['13px', { lineHeight: '1.4' }],     // Bill receipt text
        'label': ['11px', { lineHeight: '1.3' }],     // Barcode labels
      },
      spacing: {
        // Touch-friendly minimum sizes
        'touch': '44px',     // Minimum button/tap target size
        'touch-lg': '56px',  // Large button height
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'modal': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'pulse-soft': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}
