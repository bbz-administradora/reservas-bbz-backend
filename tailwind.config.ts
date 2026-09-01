import type { Config } from 'tailwindcss'

import { colors } from './src/lib/tailwind/styles/theme/tokens'

const config: Config = {
  content: [
    './src/lib/react-mail/components/**/*.{js,ts,jsx,tsx}',
    './src/lib/react-mail/emails/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors,
    },
  },
  corePlugins: {
    preflight: false, // Desativa os resets globais, que podem causar problemas em clientes de email
  },
  plugins: [],
}

export default config
