import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { htmlPlugin, type Env } from './config/htmlPlugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_') as Env & { VITE_BASE?: string };
  const base = env.VITE_BASE ?? '/anyview/';
  return {
    base,
    plugins: [react(), htmlPlugin(env, base)],
    // hidden: карты лежат рядом с чанками, но браузер их не подгружает; по ним `scripts/decode-stack.mjs` расшифровывает стек из отчёта
    build: { sourcemap: 'hidden' as const },
    // глубокий фаззинг (FC_RUNS в тысячах) идёт дольше стандартных 5 с на тест
    test: { environment: 'node', testTimeout: Number(process.env.FC_RUNS) > 1000 ? 900_000 : 5000 },
  };
});
