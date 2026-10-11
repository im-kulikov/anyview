import { createBrowserRouter, redirect } from 'react-router';
import { Layout } from './Layout';
import { RouteError } from './ErrorBoundary';
import { SearchPage } from '../features/search/SearchPage';
import { HomePage } from '../features/home/HomePage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { SoonPage } from '../features/soon/SoonPage';
import { NotFoundPage } from '../features/notfound/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      HydrateFallback: () => null,
      errorElement: <RouteError />,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/anime', element: <CatalogPage /> },
        // «Моё» переехало на страницу «Аккаунт»: старые ссылки `/library?tab=…` ведут на `/sync?tab=…`
        { path: '/library', loader: ({ request }) => redirect(`/sync${new URL(request.url).search}`) },
        { path: '/series', element: <SoonPage section="series" /> },
        { path: '/movies', element: <SoonPage section="movies" /> },
        {
          path: '/title/:id',
          lazy: async () => ({ Component: (await import('../features/title/TitlePage')).TitlePage }),
        },
        { path: '/search', element: <SearchPage /> },
        {
          path: '/sync',
          lazy: async () => ({ Component: (await import('../features/sync/SyncPage')).SyncPage }),
        },
        {
          path: '/diagnostics',
          lazy: async () => ({ Component: (await import('../features/diagnostics/DiagnosticsPage')).DiagnosticsPage }),
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
