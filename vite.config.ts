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
    test: { environment: 'node' },
  };
});
