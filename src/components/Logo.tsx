import { Link } from 'react-router';
import { S } from '../lib/strings';
import styles from './Logo.module.css';

export function Logo({ size = 32, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <Link to="/" className={styles.logo} aria-label={S.logoLabel}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="10" fill="var(--accent)" />
        <path d="M13 10.5v11l8.5-5.5z" fill="#fff" />
      </svg>
      {showWord && (
        <span className={styles.word}>
          any<span>view</span>
        </span>
      )}
    </Link>
  );
}
