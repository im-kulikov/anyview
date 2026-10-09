import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/contract';

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 2 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});
