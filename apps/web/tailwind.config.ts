import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // EPYC Brand Colors - Rich, Deep, Professional
        epyc: {
          primary: '#065F46', // Deep Forest Green
          secondary: '#047857', // Rich Emerald Green
          accent: '#059669', // Vibrant Green (highlights)
          green: '#064E3B', // Deepest Green (hero backgrounds)
          teal: '#0F766E', // Deep Teal
          blue: '#1E40AF', // Deep Royal Blue
          purple: '#7C3AED', // Accent Purple
          dark: '#0F172A', // Slate-900
          light: '#F8FAFC', // Slate-50
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'epyc-gradient': 'linear-gradient(135deg, #064E3B 0%, #0F766E 50%, #1E40AF 100%)',
        'epyc-gradient-dark': 'linear-gradient(135deg, #022C22 0%, #134E4A 50%, #1E3A5F 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
