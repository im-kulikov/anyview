import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { provider } from '../api/index';
import styles from './Cover.module.css';

interface Props {
  src?: string;
  name: string;
  /** CSS aspect-ratio: место под картинку резервируется всегда. */
  ratio?: string;
  priority?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Уже показанные обложки (по фактически загруженному адресу): карточка при возврате на экран монтируется заново, и без этого
 * каждая снова проходила бы «буква → ожидание IntersectionObserver → fade-in».
 */
const seen = new Set<string>();
const MAX_SEEN = 500;
const remember = (url: string): void => {
  seen.delete(url);
  seen.add(url);
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!);
};

/** Первый кандидат (wsrv.nl): ok0 — хоть раз загрузился, таймеры больше не нужны; skip0 — три отказа подряд без единого успеха, дальше начинаем с зеркала. */
const FIRST_TIMEOUT_MS = 8000;
const SKIP_AFTER_FAILS = 3;
let ok0 = false;
let skip0 = false;
let fails0 = 0;
const failed0 = (): void => {
  if (!ok0 && ++fails0 >= SKIP_AFTER_FAILS) skip0 = true;
};

export function Cover(props: Props) {
  // key: при смене адреса состояние (кандидат, загрузка, ошибка) начинается заново
  return <CoverInner key={props.src} {...props} />;
}

function CoverInner({ src, name, ratio = '2 / 3', priority, className = '', children }: Props) {
  const [urls] = useState(() => (src ? provider.imageUrls(src) : []));
  const [idx, setIdx] = useState(() => {
    const cached = urls.findIndex((u) => seen.has(u));
    return cached >= 0 ? cached : skip0 && urls.length > 1 ? 1 : 0;
  });
  const [loaded, setLoaded] = useState(() => urls.some((u) => seen.has(u)));
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => !!priority || loaded);

  // Картинки вне экрана не качаем (нативный lazy берёт ~1250 px запаса и забивает канал, пока грузится первая обложка).
  useEffect(() => {
    const el = boxRef.current;
    if (near || !el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setNear(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const next = useCallback(() => {
    if (idx === 0 && urls.length > 1) failed0();
    if (idx + 1 < urls.length) setIdx(idx + 1);
    else setFailed(true);
  }, [idx, urls.length]);

  // Первый кандидат молчит дольше 8 с — переходим к зеркалу (таймер только на нём и только пока wsrv ни разу не загрузился).
  useEffect(() => {
    if (!near || loaded || failed || idx !== 0 || urls.length < 2 || ok0) return;
    const t = setTimeout(next, FIRST_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [near, loaded, failed, idx, urls.length, next]);

  const done = useCallback((url: string) => {
    remember(url);
    if (url === urls[0]) {
      ok0 = true;
      fails0 = 0;
    }
    setLoaded(true);
  }, [urls]);

  // Стабильный ref: иначе React вызывает его дважды на каждый рендер каждой карточки.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) done(el.getAttribute('src') ?? '');
  }, [done]);

  const url = urls[idx];
  const showImg = url && !failed && near;
  return (
    <div ref={boxRef} className={`${styles.cover} ${className}`} style={{ aspectRatio: ratio }}>
      {showImg ? (
        <img
          ref={imgRef}
          src={url}
          alt=""
          className={`${styles.img} ${loaded ? styles.loaded : ''}`}
          referrerPolicy="no-referrer"
          fetchPriority={priority ? 'high' : 'low'}
          decoding="async"
          onLoad={() => done(url)}
          onError={next}
        />
      ) : urls.length && !failed ? null : (
        <span className={styles.letter} aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {children}
    </div>
  );
}
