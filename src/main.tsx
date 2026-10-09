import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { router } from './app/router';
import { queryClient } from './app/queryClient';
import { updatesQuery } from './api/hooks';
import { persistFeed, restoreFeed } from './api/feedCache';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';

// Лента стартует до первого рендера (SPEC §8); при повторном визите экран рисуется из снимка, пока идёт запрос.
restoreFeed(queryClient);
persistFeed(queryClient);
void queryClient.prefetchInfiniteQuery(updatesQuery());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
