import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { htmlPlugin, type Env } from './config/htmlPlugin';
import { swPlugin } from './config/swPlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_') as Env & { VITE_BASE?: string; VITE_SW?: string; VITE_BUILD_SHA?: string };
  const base = env.VITE_BASE ?? '/anyview/';
  return {
    base,
    plugins: [
      react(),
      htmlPlugin(env, base),
      swPlugin(env, base),
      // version.json читает само приложение: версия на сервере новее собственной — обновиться (src/lib/update.ts)
      { name: 'version-json', generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ sha: (env.VITE_BUILD_SHA ?? '').slice(0, 7) || 'dev' }) }); } },
    ],
    // hidden: карты лежат рядом с чанками, но браузер их не подгружает; по ним `scripts/decode-stack.mjs` расшифровывает стек из отчёта
    build: { sourcemap: 'hidden' as const },
    // глубокий фаззинг (FC_RUNS в тысячах) идёт дольше стандартных 5 с на тест
    test: { environment: 'node', testTimeout: Number(process.env.FC_RUNS) > 1000 ? 900_000 : 5000 },
  };
});
