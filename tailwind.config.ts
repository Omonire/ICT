import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: '#5B2C6F',
        purple: {
          DEFAULT: '#5B2C6F',
          50: '#F5F0F7',
          100: '#E8D5ED',
          200: '#D1ABDB',
          300: '#B981C9',
          400: '#9B5CB7',
          500: '#7D37A5',
          600: '#5B2C6F',
          700: '#4A235A',
          800: '#3A1A45',
          900: '#2A1130',
        },
        gold: {
          DEFAULT: '#D4AF37',
          50: '#FDF8E8',
          100: '#FAEEC4',
          200: '#F5DC8A',
          300: '#EFCA50',
          400: '#D4AF37',
          500: '#B8960E',
          600: '#8F740B',
          700: '#665308',
          800: '#3D3205',
          900: '#1F1902',
        },
        slate: {
          850: '#1a2536',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'card-hover': '0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'progress-stripes': {
          from: { backgroundPosition: '1rem 0' },
          to: { backgroundPosition: '0 0' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        'aurora': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '33%': { transform: 'translate3d(4%, -6%, 0) scale(1.12)' },
          '66%': { transform: 'translate3d(-5%, 4%, 0) scale(0.96)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'toast-in': 'toast-in 0.2s ease-out both',
        marquee: 'marquee 44s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 7.5s ease-in-out 1.4s infinite',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
        shimmer: 'shimmer 7s linear infinite',
        'spin-slow': 'spin-slow 24s linear infinite',
        aurora: 'aurora 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
