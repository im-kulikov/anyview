import { defineConfig } from '@playwright/test';

/**
 * E2E-smoke (ADR-32): реальный Chromium против собранного `dist/` через `vite preview`, сеть полностью подменена (e2e/mockApi.ts).
 * Перед запуском нужна сборка: `npm run build && npm run e2e`. В облачной сессии без скачанного Chromium:
 * `E2E_CHROMIUM=/путь/к/chrome npm run e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts', // не `*.spec.ts`: vitest подхватил бы такие файлы
  timeout: 30_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
  // E2E_BASE_URL (origin живого сайта) — проверка после деплоя: локальный preview не нужен
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/anyview/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
