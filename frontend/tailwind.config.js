/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        // Цвета редкости — как в игре.
        rarity: {
          CONSUMER: '#b0c3d9',
          INDUSTRIAL: '#5e98d9',
          MILSPEC: '#4b69ff',
          RESTRICTED: '#8847ff',
          CLASSIFIED: '#d32ce6',
          COVERT: '#eb4b4b',
          CONTRABAND: '#e4ae39',
        },
        ink: {
          975: '#06070a',
          950: '#0a0b0f',
          900: '#0f1117',
          850: '#151822',
          800: '#1b1f2c',
          700: '#272c3c',
          600: '#3a4155',
          500: '#4d556d',
        },
        accent: {
          300: '#ffd08a',
          400: '#ffb648',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Цвета игровых режимов
        game: {
          red: '#e0384a',
          black: '#1c2130',
          green: '#16b364',
          cyan: '#22d3ee',
          violet: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -12px rgba(245,158,11,.65)',
        'glow-lg': '0 0 70px -16px rgba(245,158,11,.75)',
        card: '0 20px 45px -28px rgba(0,0,0,.95)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.04) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shine: {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '100%': { transform: 'translateX(320%) skewX(-12deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(245,158,11,.45)' },
          '70%': { boxShadow: '0 0 0 14px rgba(245,158,11,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
        },
        'coin-flip': {
          '0%': { transform: 'rotateY(0) scale(1)' },
          '50%': { transform: 'rotateY(1440deg) scale(1.15)' },
          '100%': { transform: 'rotateY(2880deg) scale(1)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pop-in': 'pop-in .4s cubic-bezier(.2,.9,.3,1.2) both',
        shine: 'shine 3.2s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'slide-in': 'slide-in .3s ease-out both',
      },
    },
  },
}
