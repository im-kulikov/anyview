import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/contract';
import { report } from '../lib/report';

/** Повторяем сеть и 5xx (а также 408/429); not_found, parse и остальные 4xx повтором не лечатся. */
export function shouldRetry(count: number, err: unknown): boolean {
  if (count >= 2) return false;
  if (!(err instanceof ApiError)) return true;
  if (err.kind === 'not_found' || err.kind === 'parse') return false;
  if (err.kind === 'http') {
    const s = err.status ?? 0;
    return s >= 500 || s === 408 || s === 429;
  }
  return true;
}

/** В отчёты попадает то, что похоже на поломку (смена формата ответа, чужой код), а не обычные «нет сети» и «не найдено». */
export function isReportable(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (!(err instanceof ApiError)) return true;
  return err.kind === 'parse' || (err.kind === 'http' && (err.status ?? 0) >= 500);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err, query) => isReportable(err) && report(err, `query:${String(query.queryKey[0])}`),
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 2 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});
