import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

/** Уже показанные обложки: при возврате на экран карточка монтируется заново, и без этого каждая снова проходила бы «буква → ожидание IntersectionObserver → fade-in». */
const seen = new Set<string>();
const MAX_SEEN = 500;
const remember = (src: string): void => {
  seen.delete(src);
  seen.add(src);
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value!);
};

export function Cover({ src, name, ratio = '2 / 3', priority, className = '', children }: Props) {
  const [loaded, setLoaded] = useState(() => !!src && seen.has(src));
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(() => !!priority || (!!src && seen.has(src)));

  // Картинки вне экрана не качаем (нативный lazy берёт ~1250 px запаса и забивает канал, пока грузится первая обложка).
  useEffect(() => {
    const el = boxRef.current;
    if (near || !el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setNear(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // Стабильный ref: иначе React вызывает его дважды на каждый рендер каждой карточки.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) {
      remember(el.getAttribute('src') ?? '');
      setLoaded(true);
    }
  }, []);

  const showImg = src && !failed && near;
  return (
    <div ref={boxRef} className={`${styles.cover} ${className}`} style={{ aspectRatio: ratio }}>
      {showImg ? (
        <img
          ref={imgRef}
          src={src}
          alt=""
          className={`${styles.img} ${loaded ? styles.loaded : ''}`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'low'}
          decoding="async"
          onLoad={() => { remember(src); setLoaded(true); }}
          onError={() => setFailed(true)}
        />
      ) : src && !failed ? null : (
        <span className={styles.letter} aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {children}
    </div>
  );
}
