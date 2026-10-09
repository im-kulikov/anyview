import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const providers = { group: ['**/api/providers/**'], message: 'Провайдеры — только в src/api (CLAUDE.md).' };
const syncCode = { group: ['**/sync/**'], message: 'src/sync — только динамическим import() (ленивый чанк синхронизации, ADR-28); экран — в src/features/sync.' };
const firebaseSdk = { group: ['firebase', 'firebase/*'], message: 'Firebase — только в src/sync/firebase.ts (ADR-28).' };

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Слои (ARCH-21): код провайдеров — только внутри src/api; интерфейс знает контракт и ContentProvider.
    files: ['src/{app,components,features,lib,styles}/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [providers, syncCode, firebaseSdk] }],
    },
  },
  {
    // Экран синхронизации — ленивый маршрут и сам часть чанка: ему можно импортировать src/sync (но не Firebase и не провайдеров).
    files: ['src/features/sync/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [providers, firebaseSdk] }] },
  },
);
