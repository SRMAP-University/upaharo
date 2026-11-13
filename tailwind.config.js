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
        // --font-ui: Plus Jakarta Sans on the shop, Inter in admin (see globals.css).
        sans: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-ui)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      // Theme colours come from CSS variables (globals.css): the shop uses the
      // "Studio" theme; admin pages keep the classic wine theme (.theme-classic).
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
          DEFAULT: 'rgb(var(--c-wine) / <alpha-value>)',
          deep: 'rgb(var(--c-wine-deep) / <alpha-value>)',
        },
        rose: {
          brand: 'rgb(var(--c-rose-brand) / <alpha-value>)',
          soft: 'rgb(var(--c-rose-soft) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'rgb(var(--c-gold) / <alpha-value>)',
          soft: 'rgb(var(--c-gold-soft) / <alpha-value>)',
          bright: 'rgb(var(--c-gold-bright) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--c-cream) / <alpha-value>)',
          deep: 'rgb(var(--c-cream-deep) / <alpha-value>)',
        },
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        blush: {
          DEFAULT: 'rgb(var(--c-blush) / <alpha-value>)',
          soft: 'rgb(var(--c-blush-soft) / <alpha-value>)',
          mid: 'rgb(var(--c-blush-mid) / <alpha-value>)',
          deep: 'rgb(var(--c-blush-deep) / <alpha-value>)',
        },
        // Studio: the logo red, for sale badges, links and highlights.
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          dark: 'rgb(var(--c-brand-dark) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
        },
        // Light grey surfaces (search, chips, image wells).
        mist: {
          DEFAULT: 'rgb(var(--c-mist) / <alpha-value>)',
          deep: 'rgb(var(--c-mist-deep) / <alpha-value>)',
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
