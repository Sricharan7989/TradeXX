// Shared Tailwind preset — Zerodha-adjacent dark-first theme: dense, calm,
// information-first. Consumers (apps/web) spread this into their own
// tailwind.config.ts `presets: [require('@tradex/config/tailwind')]`.

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand accent
        accent: {
          DEFAULT: '#387ed1',
          50: '#eaf2fb',
          100: '#cfe3f6',
          200: '#9fc7ed',
          300: '#6fabe4',
          400: '#4f95da',
          500: '#387ed1',
          600: '#2d65a8',
          700: '#224c7f',
          800: '#173356',
          900: '#0c1a2d',
        },
        // Market semantics — never reuse for anything but gain/loss/buy/sell.
        gain: {
          DEFAULT: '#00b386',
          muted: '#0a3d31',
        },
        loss: {
          DEFAULT: '#eb5b3c',
          muted: '#4a2018',
        },
        // Neutral surface scale for the dark-first shell.
        surface: {
          0: '#0b0e14',
          1: '#11151d',
          2: '#171c26',
          3: '#1f2530',
          border: '#262c38',
        },
        ink: {
          DEFAULT: '#e6e9ef',
          muted: '#8b93a3',
          faint: '#5b6473',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
