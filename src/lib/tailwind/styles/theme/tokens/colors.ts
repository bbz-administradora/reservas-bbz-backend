export const colors = {
  foreground: '#212529',
  background: '#ffffff',

  primary: {
    DEFAULT: '#04193b',
    foreground: '#FFFFFF',
  },

  secondary: {
    DEFAULT: '#b0d4ff',
    foreground: '#04193b',
  },

  tertiary: {
    DEFAULT: '#0664e4',
    foreground: '#FFFFFF',
  },

  border: '#eaeaea',

  muted: {
    DEFAULT: '#666666',
    foreground: '#000000',
  },

  link: '#0D6EFD',

  accent: {
    DEFAULT: '#8578ef',
    foreground: '#ffffff',
  },

  success: {
    DEFAULT: '#22c55e',
    foreground: '#FFFFFF',
  },

  warning: '#fde68a',
}

export type ColorKey = keyof typeof colors
