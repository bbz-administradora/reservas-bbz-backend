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
  // A entrada serverless da Vercel é CommonJS: ela carrega o bundle do tsup
  // (build/app.js), que é CJS, e o pacote não declara "type": "module".
  // `require` ali é o formato correto, não um desvio de padrão.
  {
    files: ['api/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
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
