import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      // __VERSION__: el commit desplegado, lo pone Vite al compilar (vite.config.js)
      globals: { ...globals.browser, __VERSION__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        // useAuth vive junto a su proveedor: separarlo obligaría a cambiar 19
        // imports y los mocks de los tests, y solo afecta a la recarga en caliente
        { allowConstantExport: true, allowExportNames: ['useAuth'] },
      ],
    },
  },
  // La configuración de Vite corre en Node, no en el navegador
  {
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
]
