import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // core is pure TS: no React, no DOM, no wall clock (time enters only as ticks)
    files: ['src/core/**/*.{ts,tsx}', 'src/save/serialize*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom'],
          patterns: ['react/*', 'react-dom/*'],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'navigator'],
      'no-restricted-properties': ['error', { object: 'Date', property: 'now', message: 'Time enters core only as ticks.' }],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'Time enters core only as ticks.' },
      ],
    },
  },
])
