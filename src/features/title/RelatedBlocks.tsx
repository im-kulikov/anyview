import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { RelatedTitles } from '../../api/contract';
import { PosterGrid } from '../../components/PosterGrid';
import { Rail } from '../../components/Rail';
import { TitleCard } from '../../components/TitleCard';
import { S } from '../../lib/strings';
import styles from './RelatedBlocks.module.css';

/** Сколько «Похожих» в ленте до «Показать все». */
const SIMILAR_PREVIEW = 10;

/**
 * «Сезоны»: ссылки на соседние сезоны франшизы. Только при ≥ 2 сезонах. Пока связи грузятся, место зарезервировано
 * (`pending`), чтобы плеер ниже не прыгал. Данные приходят готовыми из провайдера — компонент ничего не знает об источнике.
 */
export function SeasonsBlock({ related, pending }: { related?: RelatedTitles; pending: boolean }) {
  const listRef = useRef<HTMLUListElement>(null);
  const seasons = related?.seasons ?? [];
  const show = seasons.length >= 2;

  // Текущий сезон в видимой части ряда: прокручиваем сам ряд (не scrollIntoView, он двигает страницу).
  useEffect(() => {
    const list = listRef.current;
    const cur = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && cur) list.scrollLeft = cur.offsetLeft - (list.clientWidth - cur.offsetWidth) / 2;
  }, [show]);

  if (pending) return <div className={styles.reserve} aria-hidden="true" />;
  if (!show) return null;
  return (
    <section className={styles.block} aria-labelledby="seasons-h">
      <h2 id="seasons-h" className={styles.h}>{S.title.seasons}</h2>
      <ul ref={listRef} className={styles.seasons}>
        {seasons.map((s) => (
          <li key={s.id}>
            <Link to={`/title/${s.id}`} className={styles.pill} aria-current={s.current ? 'page' : undefined}>
              <span>{s.label}</span>
              {s.year && <small>{s.year}</small>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** «Похожие»: лента из первых 10; «Показать все» раскрывает остальные сеткой. Только при ≥ 1. */
export function SimilarBlock({ related }: { related?: RelatedTitles }) {
  const [all, setAll] = useState(false);
  const items = related?.similar ?? [];
  if (!items.length) return null;
  const more = items.length > SIMILAR_PREVIEW;
  return (
    <section className={styles.block} aria-labelledby="similar-h">
      <h2 id="similar-h" className={styles.h}>{S.title.similar}</h2>
      {all ? (
        <PosterGrid items={items} showEpisode={false} />
      ) : (
        <Rail>
          {items.slice(0, SIMILAR_PREVIEW).map((t) => <TitleCard key={t.id} title={t} className={styles.railCard} />)}
        </Rail>
      )}
      {more && !all && (
        <button type="button" className={styles.more} onClick={() => setAll(true)}>
          {S.title.similarAll(items.length)}
        </button>
      )}
    </section>
  );
}
