import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/contract';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 2 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, err) =>
        count < 2 && !(err instanceof ApiError && (err.kind === 'not_found' || err.kind === 'parse')),
    },
  },
});
