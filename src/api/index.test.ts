import { expect, test } from 'vitest';
import { createProvider } from './index';

test('VITE_PROVIDER: по умолчанию animevost', async () => {
  const cat = await createProvider({}).catalog();
  expect(cat.types[0].type).toBe('anime');
});

test('VITE_PROVIDER=anyview: явная ошибка «не реализовано»', async () => {
  const p = createProvider({ VITE_PROVIDER: 'anyview', VITE_API_BASE: 'https://x.test' });
  await expect(p.title('t1')).rejects.toThrow(/not implemented/);
});

test('неизвестный провайдер — ошибка конфигурации', () => {
  expect(() => createProvider({ VITE_PROVIDER: 'foo' })).toThrow(/Unknown VITE_PROVIDER/);
});
