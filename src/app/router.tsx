import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { Stub } from './Stub';
import { HomePage } from '../features/home/HomePage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { SoonPage } from '../features/soon/SoonPage';
import { NotFoundPage } from '../features/notfound/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      HydrateFallback: () => null,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/anime', element: <CatalogPage /> },
        { path: '/series', element: <SoonPage section="series" /> },
        { path: '/movies', element: <SoonPage section="movies" /> },
        {
          path: '/title/:id',
          lazy: async () => ({ Component: (await import('../features/title/TitlePage')).TitlePage }),
        },
        { path: '/search', element: <Stub name="Поиск" /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
