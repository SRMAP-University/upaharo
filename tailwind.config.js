/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#fc8019',
          dark: '#e07316',
          light: '#ffa74f'
        },
        secondary: {
          DEFAULT: '#1a1a1a',
          light: '#3a3a3a'
        },
        wine: {
          DEFAULT: '#7c2a47',
          deep: '#5d1d34',
        },
        rose: {
          brand: '#c2496a',
          soft: '#f6e3e8',
        },
        gold: {
          DEFAULT: '#b8893f',
          soft: '#f3e7d0',
        },
        cream: {
          DEFAULT: '#faf5f0',
          deep: '#f3ebe2',
        },
        ink: '#2b1d22',
        blush: {
          DEFAULT: '#E85A8C',
          soft: '#FFE4EC',
          mid: '#FFD0DE',
          deep: '#FFC0D4',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'gift-marquee': 'giftMarquee linear infinite',
        'gift-marquee-reverse': 'giftMarqueeReverse linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        giftMarquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        giftMarqueeReverse: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
      }
    },
  },
  plugins: [],
}
