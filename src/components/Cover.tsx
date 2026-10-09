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

export function Cover({ src, name, ratio = '2 / 3', priority, className = '', children }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!!priority);

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
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
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
          onLoad={() => setLoaded(true)}
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
