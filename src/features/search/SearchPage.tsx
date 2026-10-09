import { Link, useSearchParams } from 'react-router';
import { Clock, SearchX, Star } from 'lucide-react';
import { useSearch, useUpdates } from '../../api/hooks';
import type { TitleSummary } from '../../api/contract';
import { Cover } from '../../components/Cover';
import { ErrorState } from '../../components/ErrorState';
import { PosterGrid } from '../../components/PosterGrid';
import { Skeleton } from '../../components/Skeleton';
import { S } from '../../lib/strings';
import { cardMeta, ratingText } from '../../lib/format';
import { addRecentSearch, recentStore, useStore } from '../../lib/storage';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './SearchPage.module.css';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('q') ?? '';
  const q = useDebouncedValue(raw.trim(), 100);
  const active = q.length >= 2 && raw.trim().length >= 2;
  const search = useSearch(active ? q : '');
  const recent = useStore(recentStore);
  const feed = useUpdates();
  useDocumentTitle(active ? S.searchPage.heading(q) : S.searchPage.title);

  // Подстановка запроса из «недавних»: тот же URL-механизм, что у поля в шапке (replace).
  const pick = (text: string) => setParams({ q: text }, { replace: true, preventScrollReset: true });
  const remember = () => addRecentSearch(q);

  const items = search.data?.items;
  const popular = feed.data?.pages[0]?.items.slice(0, 8) ?? [];

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <div>
          <h1>{active ? S.searchPage.heading(q) : S.searchPage.title}</h1>
          {active && items && <p className={styles.found}>{S.searchPage.found(items.length)}</p>}
          {!active && <p className={styles.found}>{raw.trim().length === 1 ? S.searchPage.minChars : S.searchPage.popular}</p>}
        </div>
        <div role="group" aria-label={S.searchPage.scope} className={styles.scope}>
          <button type="button" aria-pressed="true" className={styles.on}>{S.searchPage.anime}</button>
          <button type="button" disabled>{S.searchPage.seriesSoon}</button>
          <button type="button" disabled>{S.searchPage.moviesSoon}</button>
        </div>
      </div>

      {!active && recent.length > 0 && (
        <section className={styles.recent}>
          <h2>{S.searchPage.recent}</h2>
          <div className={styles.chips}>
            <span className={styles.inline}>{S.searchPage.recentInline}</span>
            {recent.map((r) => (
              <button key={r} type="button" onClick={() => pick(r)}>
                <Clock size={18} aria-hidden="true" />
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      {!active && popular.length > 0 && (
        <section className={styles.results}>
          <List items={popular} onOpen={() => undefined} />
        </section>
      )}

      {active && search.isError && <ErrorState onRetry={() => void search.refetch()} />}
      {active && search.isPending && !search.isError && <Loading />}
      {active && items && items.length === 0 && (
        <div className={styles.empty}>
          <SearchX size={36} aria-hidden="true" />
          <p>{S.searchPage.emptyTitle}</p>
          <p>{S.searchPage.emptyHint}</p>
        </div>
      )}
      {active && items && items.length > 0 && (
        <section className={styles.results}>
          <List items={items} onOpen={remember} />
        </section>
      )}
    </main>
  );
}

/** Телефон — список, десктоп — сетка карточек (оба в DOM не рисуем: переключаем CSS-ом одну разметку). */
function List({ items, onOpen }: { items: TitleSummary[]; onOpen: () => void }) {
  return (
    <>
      <ul className={styles.list}>
        {items.map((t) => (
          <li key={t.id}>
            <Link to={`/title/${t.id}`} onClick={onOpen} className={styles.row}>
              <Cover src={t.poster?.url} name={t.name} className={styles.thumb} />
              <span className={styles.rowText}>
                <b>{t.name}</b>
                {t.originalName && <span>{t.originalName}</span>}
                <span className={styles.rowMeta}>
                  {cardMeta(t)}
                  {t.rating && (
                    <>
                      {cardMeta(t) && ' · '}
                      <Star size={11} fill="var(--star)" stroke="none" aria-hidden="true" />
                      {ratingText(t.rating.value)}
                    </>
                  )}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.grid}>
        <PosterGrid items={items} showEpisode={false} showOriginal onOpen={onOpen} />
      </div>
    </>
  );
}

function Loading() {
  return (
    <div role="status" aria-label={S.common.loading} className={styles.loading}>
      <ul className={styles.list}>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className={styles.row}>
            <Skeleton className={styles.thumb} style={{ aspectRatio: '2 / 3' }} />
            <Skeleton style={{ flex: 1, height: 48, borderRadius: 8 }} />
          </li>
        ))}
      </ul>
      <div className={styles.grid}>
        <PosterGrid items={[]} skeletons={12} />
      </div>
    </div>
  );
}
