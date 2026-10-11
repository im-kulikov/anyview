import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Grid2x2, Grid3x3, Shuffle } from 'lucide-react';
import { useUpdates } from '../../api/hooks';
import { PosterGrid } from '../../components/PosterGrid';
import { ErrorState } from '../../components/ErrorState';
import { S } from '../../lib/strings';
import { formatNumber, titlesWord } from '../../lib/format';
import { setPrefs, usePrefs } from '../../lib/storage';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './CatalogPage.module.css';

export function CatalogPage() {
  useDocumentTitle(S.catalog.title);
  const q = useUpdates();
  const navigate = useNavigate();
  const { cols } = usePrefs();
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = q;
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasNextPage && !isFetchingNextPage && !isFetchNextPageError;

  // Подгрузка за 600 px до конца; при ошибке — только по кнопке «Повторить».
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoad) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && void fetchNextPage(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoad, fetchNextPage]);

  const items = q.data?.items;
  const total = q.data?.pages[0]?.total;

  if (q.isError && !items) {
    return <main className={styles.main}><ErrorState onRetry={() => void q.refetch()} /></main>;
  }

  return (
    <main className={styles.main}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1>{S.catalog.title}</h1>
          {total !== undefined && (
            <p>{S.catalog.subtitle(formatNumber(total), titlesWord(total))}</p>
          )}
        </div>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} disabled={!items?.length} aria-label={S.catalog.randomLabel}
            onClick={() => items?.length && navigate(`/title/${items[Math.floor(Math.random() * items.length)].id}`)}>
            <Shuffle size={20} aria-hidden="true" />
            <span>{S.catalog.random}</span>
          </button>
          <button type="button" className={`${styles.tool} ${styles.colsBtn}`} aria-label={cols === 3 ? S.catalog.cols2 : S.catalog.cols3}
            onClick={() => setPrefs({ cols: cols === 3 ? 2 : 3 })}>
            {cols === 3 ? <Grid2x2 size={20} aria-hidden="true" /> : <Grid3x3 size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <PosterGrid items={items ?? []} skeletons={!items ? 12 : isFetchingNextPage ? 6 : 0} priorityCount={3} />
      {isFetchingNextPage && <p role="status" className={styles.status}>{S.common.loadingMore}</p>}
      {isFetchNextPageError && (
        <div className={styles.status}>
          <span>{S.common.loadFailed}</span>
          <button type="button" className={styles.retry} onClick={() => void fetchNextPage()}>
            {S.common.retry}
          </button>
        </div>
      )}
      <div ref={sentinel} aria-hidden="true" />
    </main>
  );
}
