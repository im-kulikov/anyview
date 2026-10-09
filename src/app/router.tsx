import { createBrowserRouter } from 'react-router';
import { Layout } from './Layout';
import { Stub } from './Stub';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/', element: <Stub name="Главная" /> },
        { path: '/anime', element: <Stub name="Аниме" /> },
        { path: '/series', element: <Stub name="Сериалы" /> },
        { path: '/movies', element: <Stub name="Фильмы" /> },
        { path: '/title/:id', element: <Stub name="Тайтл" /> },
        { path: '/search', element: <Stub name="Поиск" /> },
        { path: '*', element: <Stub name="Такой страницы нет" /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
