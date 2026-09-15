import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        kshoocky: {
          navy: '#0B1320',
          gold: '#E5B869',
          light: '#F9F9F9',
        }
      },
    },
  },
  plugins: [],
}
export default config
