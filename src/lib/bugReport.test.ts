import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const data = new Map<string, string>();
const api = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
vi.stubGlobal('localStorage', new Proxy(api, {
  ownKeys: () => [...data.keys()],
  getOwnPropertyDescriptor: (_t, k) => (data.has(String(k)) ? { enumerable: true, configurable: true, value: data.get(String(k)) } : undefined),
}));
vi.stubGlobal('location', { pathname: '/anyview/title/av-1', search: '?episode=e1', hash: '' });
vi.stubGlobal('navigator', { userAgent: 'TestUA/1.0', language: 'ru-RU', onLine: true });
vi.stubGlobal('innerWidth', 390);
vi.stubGlobal('innerHeight', 844);
vi.stubGlobal('devicePixelRatio', 3);

const { buildBugReport } = await import('./bugReport');
const { report, resetReports } = await import('./report');

beforeEach(() => {
  data.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  resetReports();
  vi.restoreAllMocks();
});

test('отчёт: версия, страница, окружение, ошибка со стеком', () => {
  const r = buildBugReport({ error: new Error('boom'), now: new Date('2026-10-11T12:00:00Z') });
  expect(r).toContain('Версия: ');
  expect(r).toContain('2026-10-11T12:00:00.000Z');
  expect(r).toContain('/anyview/title/av-1?episode=e1');
  expect(r).toContain('TestUA/1.0');
  expect(r).toContain('390×844 @3x');
  expect(r).toContain('Error: boom');
});

test('хранилище: только ключи anyview:*, размеры и формы, без содержимого', () => {
  data.set('anyview:v1:history', JSON.stringify([{ title: { name: 'СЕКРЕТНЫЙ ТАЙТЛ' } }]));
  data.set('anyview:v1:prefs', '{"speed":1}');
  data.set('anyview:v1:broken', '{не json');
  data.set('other:token', 'ЧУЖОЙ СЕКРЕТ');
  const r = buildBugReport();
  expect(r).toContain('anyview:v1:history');
  expect(r).toContain('массив[1]');
  expect(r).toContain('объект{1}');
  expect(r).toContain('НЕ JSON');
  expect(r).not.toContain('СЕКРЕТНЫЙ ТАЙТЛ');
  expect(r).not.toContain('other:token');
  expect(r).not.toContain('ЧУЖОЙ СЕКРЕТ');
});

test('includeData добавляет содержимое, но с лимитом; ключ ленты не включается', () => {
  data.set('anyview:v1:history', JSON.stringify([{ name: 'ВИДНО' }]));
  data.set('anyview:v1:feed', JSON.stringify({ items: 'x'.repeat(50) }));
  data.set('anyview:v1:big', 'a'.repeat(50_000));
  const r = buildBugReport({ includeData: true });
  expect(r).toContain('ВИДНО');
  expect(r).toContain('(обрезано)');
  expect(r).not.toContain('anyview:v1:feed: {');
  expect(r.length).toBeLessThan(30_000);
});

test('последние ошибки вкладки попадают в отчёт (дубли — один раз)', () => {
  report(new Error('первая'), 'ctx');
  report(new Error('первая'), 'ctx');
  report('строка без стека', 'other');
  const r = buildBugReport();
  expect(r).toContain('Последние ошибки вкладки (2)');
  expect(r).toContain('ctx: Error: первая');
  expect(r).toContain('other: строка без стека');
});

test('сбой сбора одной секции не роняет отчёт', () => {
  vi.stubGlobal('location', undefined);
  expect(() => buildBugReport()).not.toThrow();
  expect(buildBugReport()).toContain('не удалось собрать');
  vi.stubGlobal('location', { pathname: '/', search: '', hash: '' });
});
