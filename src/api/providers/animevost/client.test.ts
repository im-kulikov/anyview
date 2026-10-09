import { afterEach, describe, expect, test, vi } from 'vitest';
import { createClient } from './client';

const A = 'https://a.test';
const B = 'https://b.test';
const ok = (body: unknown = { ok: 1 }) => Promise.resolve(new Response(JSON.stringify(body)));
const status = (s: number) => Promise.resolve(new Response('<html>stub</html>', { status: s }));
const hang = (init: RequestInit) =>
  new Promise<Response>((_, rej) => init.signal?.addEventListener('abort', () => rej(init.signal?.reason)));

afterEach(() => vi.unstubAllGlobals());

describe('клиент animevost', () => {
  test('5xx первой базы → вторая база (CODE-05)', async () => {
    const f = vi.fn((url: string) => (url.startsWith(A) ? status(502) : ok()));
    vi.stubGlobal('fetch', f);
    await expect(createClient([A, B]).request('/last')).resolves.toEqual({ ok: 1 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('мусорное тело (HTML заглушки) → вторая база', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.startsWith(A) ? Promise.resolve(new Response('<html>')) : ok())));
    await expect(createClient([A, B]).request('/last')).resolves.toEqual({ ok: 1 });
  });

  test('4xx не перебирает базы', async () => {
    const f = vi.fn(() => status(404));
    vi.stubGlobal('fetch', f);
    await expect(createClient([A, B]).request('/x')).rejects.toMatchObject({ kind: 'http', status: 404 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('все базы 5xx → http с кодом', async () => {
    vi.stubGlobal('fetch', vi.fn(() => status(503)));
    await expect(createClient([A, B]).request('/x')).rejects.toMatchObject({ kind: 'http', status: 503 });
  });

  test('зависшая база: таймаут → вторая база', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => (url.startsWith(A) ? hang(init) : ok())));
    await expect(createClient([A, B], 20).request('/x')).resolves.toEqual({ ok: 1 });
  });

  test('таймаут единственной базы → network', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => hang(init)));
    await expect(createClient([A], 20).request('/x')).rejects.toMatchObject({ kind: 'network' });
  });

  test('отмена вызывающим → AbortError без перебора', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => hang(init));
    vi.stubGlobal('fetch', f);
    const ac = new AbortController();
    const p = createClient([A, B]).request('/x', { signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('requestOnce тоже с таймаутом', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => hang(init)));
    await expect(createClient([A], 20).requestOnce('/search')).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
