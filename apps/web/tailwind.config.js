/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-subtle': 'var(--surface-subtle)',
        'surface-elevated': 'var(--surface-elevated)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-subtle': 'var(--border-subtle)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'action-primary': 'var(--action-primary)',
        'action-primary-hover': 'var(--action-primary-hover)',
        'action-secondary': 'var(--action-secondary)',
        'action-secondary-hover': 'var(--action-secondary-hover)',
        'focus-ring': 'var(--focus-ring)',
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
        brand: ['var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
        ui: ['var(--font-inter)', 'var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
        learning: ['var(--font-lexend)', 'var(--font-be-vietnam-pro)', 'system-ui', 'sans-serif'],
        editorial: ['var(--font-noto-serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
};
