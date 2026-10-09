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

export function createClient(bases: string[]): Client {
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
      const res = await fetch(base + path, init);
      if (res.ok) worked.add(base);
      return res;
    },
    async request<T>(path: string, init?: RequestInit) {
      let last: unknown;
      for (let i = 0; i < bases.length; i++) {
        const idx = (current + i) % bases.length;
        try {
          const res = await fetch(bases[idx] + path, init);
          current = idx;
          worked.add(bases[idx]);
          return await parse<T>(res);
        } catch (e) {
          if (isAbort(e) || e instanceof ApiError) throw e;
          last = e;
        }
      }
      throw new ApiError('network', last instanceof Error ? last.message : 'Нет соединения');
    },
  };
}

export const form = (data: Record<string, string>): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(data),
});
