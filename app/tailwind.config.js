/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadow Delve dark fantasy palette
        abyss: {
          950: '#0a0a0f',
          900: '#0f0f18',
          800: '#151520',
          700: '#1a1a2e',
          600: '#252540',
        },
        ember: {
          500: '#ff6b35',
          400: '#ff8c5a',
          300: '#ffb088',
        },
        mystic: {
          600: '#4a1942',
          500: '#6b2d5c',
          400: '#8b3a75',
        },
        gold: {
          500: '#ffd700',
          400: '#ffe44d',
          300: '#fff08c',
        },
        fog: {
          500: '#2a2a3d',
          400: '#3d3d55',
          300: '#50506d',
        }
      },
      fontFamily: {
        display: ['Cinzel', 'Georgia', 'serif'],
        body: ['Crimson Text', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flicker': 'flicker 2s ease-in-out infinite',
        'fog-drift': 'fogDrift 8s ease-in-out infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        fogDrift: {
          '0%, 100%': { transform: 'translateX(0) translateY(0)' },
          '50%': { transform: 'translateX(5px) translateY(-5px)' },
        }
      },
      boxShadow: {
        'glow-ember': '0 0 20px rgba(255, 107, 53, 0.5)',
        'glow-gold': '0 0 15px rgba(255, 215, 0, 0.4)',
        'inner-abyss': 'inset 0 0 50px rgba(0, 0, 0, 0.8)',
      }
    },
  },
  plugins: [],
}
