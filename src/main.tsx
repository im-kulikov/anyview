import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { queryClient } from './app/queryClient';
import { updatesQuery } from './api/hooks';
import { persistFeed, restoreFeed } from './api/feedCache';
import { watchFeedFreshness } from './api/refresh';
import { installDiagnostics } from './app/diagnostics';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

// Лента стартует до первого рендера (SPEC §8); при повторном визите экран рисуется из снимка, пока идёт запрос.
installDiagnostics();
restoreFeed(queryClient);
persistFeed(queryClient);
watchFeedFreshness(queryClient);
void queryClient.prefetchInfiniteQuery(updatesQuery());
// Синхронизация (ADR-28): только если пользователь уже входил на этом устройстве; код грузится отдельным чанком после первой отрисовки.
try {
  if (localStorage.getItem('anyview:sync') === '1') setTimeout(() => void import('./sync/engine').then((e) => e.start()), 2000);
} catch {
  /* localStorage недоступен */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
