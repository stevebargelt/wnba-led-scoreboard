/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Existing palette (keep for backward compat with existing components + tests)
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          // Map to new accent token so bg-primary-600 = accent color
          500: '#6366f1',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#312e81',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },

        // New design tokens (CSS var–backed, respond to light/dark)
        // NOTE: do NOT add a color named `base` — it collides with the built-in
        // `text-base` font-size utility and emits a spurious `color: var(--color-bg)`.
        // For the app background use `bg-[var(--color-bg)]` or the body rule in globals.css.
        surface: {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          fg: 'var(--color-accent-fg)',
          soft: 'var(--color-accent-soft)',
          'soft-fg': 'var(--color-accent-soft-fg)',
        },
        'success-soft': 'var(--color-success-soft)',
        'success-fg': 'var(--color-success-fg)',
        'success-dot': 'var(--color-success-dot)',
        'offline-dot': 'var(--color-offline-dot)',
        danger: {
          DEFAULT: 'var(--color-danger)',
          hover: 'var(--color-danger-hover)',
          soft: 'var(--color-danger-soft)',
          fg: 'var(--color-danger-fg)',
        },
        amber: {
          DEFAULT: 'var(--color-amber)',
          soft: 'var(--color-amber-soft)',
          fg: 'var(--color-amber-fg)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        md: 'var(--radius-md)',
        // sm is already in Tailwind defaults; add 'token-sm' for our custom sm
        'token-sm': 'var(--radius-sm)',
        pill: 'var(--radius-pill)',
        xl: '0.75rem',
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
  darkMode: 'class',
}
