/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sunken: 'var(--bg-sunken)',
        base: 'var(--bg-base)',
        raised: 'var(--bg-raised)',
        overlay: 'var(--bg-overlay)',
        line: 'var(--border-subtle)',
        strong: 'var(--border-strong)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        disabled: 'var(--text-disabled)',
        link: 'var(--link)',
        accent: 'var(--accent)',
        'accent-muted': 'var(--accent-muted)',
        danger: 'var(--danger)',
        warn: 'var(--warn)',
        success: 'var(--success)',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        serif: ['Source Serif 4', 'Noto Sans SC', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['12px', '1.65'],
        sm: ['13px', '1.65'],
        base: ['14px', '1.65'],
        md: ['16px', '1.65'],
        lg: ['18px', '1.65'],
        xl: ['22px', '1.4'],
        '2xl': ['28px', '1.35'],
      },
      borderRadius: {
        DEFAULT: '5px',
        sm: '4px',
        md: '5px',
        lg: '6px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.4)',
        overlay: '0 8px 24px rgba(0,0,0,.45)',
      },
      maxWidth: {
        prose: '760px',
      },
    },
  },
  plugins: [],
};
