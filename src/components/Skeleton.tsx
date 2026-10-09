import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`${styles.skeleton} ${className}`} style={style} />;
}
