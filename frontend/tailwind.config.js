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
        primary: {
          DEFAULT: '#171717',
          hover: '#000000',
          light: '#404040',
        },
        secondary: '#737373',
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
        surface: '#FFFFFF',
        panel: '#FAFAFA',
        app: '#F5F5F5',
        hover: '#F0F0F0',
        active: '#E5E5E5',
        border: {
          DEFAULT: '#E5E5E5',
          light: '#F0F0F0',
          medium: '#D4D4D4',
          focus: '#171717',
        },
        text: {
          primary: '#171717',
          secondary: '#525252',
          tertiary: '#A3A3A3',
        },
        accent: {
          DEFAULT: '#171717',
          muted: '#404040',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      height: {
        header: '60px',
      },
    },
  },
  plugins: [],
};
