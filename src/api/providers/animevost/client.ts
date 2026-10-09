import { ApiError } from '../../contract';

export interface Client {
  /** Запрос с перебором баз при сетевой ошибке. */
  request<T>(path: string, init?: RequestInit): Promise<T>;
  /** Один запрос к текущей базе, без перебора; сеть → TypeError наружу. */
  requestOnce(path: string, init?: RequestInit): Promise<Response>;
  /** Отвечала ли текущая база успешно в этой сессии. */
  baseWorked(): boolean;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export const REQUEST_TIMEOUT_MS = 10_000;

/** Таймаут + сигнал вызывающего: ушёл со страницы — AbortError, завис сервер — TimeoutError. */
const withTimeout = (init: RequestInit | undefined, ms: number): RequestInit => ({
  ...init,
  signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms),
});

export function createClient(bases: string[], timeoutMs = REQUEST_TIMEOUT_MS): Client {
  let current = 0;
  const worked = new Set<string>();

  async function parse<T>(res: Response): Promise<T> {
    if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`, res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError('parse', 'Некорректный ответ API');
    }
  }

  return {
    baseWorked: () => worked.has(bases[current]),
    async requestOnce(path, init) {
      const base = bases[current];
      const res = await fetch(base + path, withTimeout(init, timeoutMs));
      if (res.ok) worked.add(base);
      return res;
    },
    async request<T>(path: string, init?: RequestInit) {
      let last: unknown;
      for (let i = 0; i < bases.length; i++) {
        const idx = (current + i) % bases.length;
        try {
          const res = await fetch(bases[idx] + path, withTimeout(init, timeoutMs));
          const data = await parse<T>(res);
          current = idx;
          worked.add(bases[idx]);
          return data;
        } catch (e) {
          if (isAbort(e)) throw e;
          // 4xx — ответ по существу, другая база не поможет; сеть, таймаут, 5xx и мусорное тело — пробуем следующую
          if (e instanceof ApiError && e.kind === 'http' && (e.status ?? 0) < 500) throw e;
          last = e;
        }
      }
      if (last instanceof ApiError) throw last;
      throw new ApiError('network', last instanceof Error ? last.message : 'Нет соединения');
    },
  };
}

export const form = (data: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(data),
});
