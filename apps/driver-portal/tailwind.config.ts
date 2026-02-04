import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // EPYC Brand Colors (from website - darker for readability)
        epyc: {
          primary: '#047857', // Dark EPYC Green
          secondary: '#059669', // Medium Green
          accent: '#10B981', // Emerald-500 (highlight color)
          green: '#047857', // Dark EPYC Green (hero backgrounds)
          teal: '#0d7490', // Dark Teal transition
          blue: '#0369a1', // Dark EPYC Blue
          dark: '#111827', // Gray-900
          light: '#F9FAFB', // Gray-50
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
