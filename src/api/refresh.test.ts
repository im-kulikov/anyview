import { expect, test } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { refreshFeed } from './refresh';
import { keys } from './keys';

const page = (n: number, ...ids: string[]) => ({ items: ids.map((id) => ({ id }) as never), page: n, pageSize: 30, hasMore: true });
type Feed = { pages: { page: number; items: { id: string }[] }[] };

test('заменяется только первая страница, остальные остаются', async () => {
  const qc = new QueryClient();
  qc.setQueryData(keys.updates(), { pages: [page(1, 'a'), page(2, 'b')], pageParams: [1, 2] });
  await refreshFeed(qc, () => Promise.resolve(page(1, 'new')));
  const d = qc.getQueryData<Feed>(keys.updates())!;
  expect(d.pages.map((p) => p.items[0].id)).toEqual(['new', 'b']);
});

test('ошибка загрузки не трогает данные; без данных ничего не создаётся', async () => {
  const qc = new QueryClient();
  await refreshFeed(qc, () => Promise.resolve(page(1, 'x')));
  expect(qc.getQueryData(keys.updates())).toBeUndefined();
  qc.setQueryData(keys.updates(), { pages: [page(1, 'a')], pageParams: [1] });
  await refreshFeed(qc, () => Promise.reject(new Error('net')));
  expect(qc.getQueryData<Feed>(keys.updates())!.pages[0].items[0].id).toBe('a');
});
