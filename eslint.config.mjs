import pluginJs from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const eslintConfig = [
  // Ignore build directories
  {
    ignores: ['dist/', 'build/'],
  },
  // Specify files to lint
  {
    files: ['src/**/*.{js,mjs,cjs,ts,tsx}'],
  },
  // Set language options for Node globals
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  // Custom rules
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]

export default eslintConfig
