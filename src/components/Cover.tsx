import { useState, type ReactNode } from 'react';
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
  const showImg = src && !failed;
  return (
    <div className={`${styles.cover} ${className}`} style={{ aspectRatio: ratio }}>
      {showImg ? (
        <img
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          src={src}
          alt=""
          className={`${styles.img} ${loaded ? styles.loaded : ''}`}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : undefined}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.letter} aria-hidden="true">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      {children}
    </div>
  );
}
