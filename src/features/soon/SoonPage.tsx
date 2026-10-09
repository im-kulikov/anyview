import { Link } from 'react-router';
import { Check, Film, Tv } from 'lucide-react';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './SoonPage.module.css';

export function SoonPage({ section }: { section: 'series' | 'movies' }) {
  const t = S.soon[section];
  const Icon = section === 'series' ? Tv : Film;
  useDocumentTitle(t.title);
  return (
    <main className={styles.main}>
      <div className={styles.art} aria-hidden="true">
        <div className={`${styles.card} ${styles.left}`}>
          <i />
          <i />
        </div>
        <div className={`${styles.card} ${styles.right}`}>
          <i />
          <i />
        </div>
        <div className={`${styles.card} ${styles.front}`}>
          <i />
          <i />
        </div>
        <div className={styles.circle}>
          <Icon size={28} />
        </div>
        <span className={styles.stamp}>{S.soon.badge}</span>
      </div>
      <div className={styles.content}>
        <div className={styles.text}>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
        </div>
        <ul className={styles.features}>
          {t.features.map((f) => (
            <li key={f}>
              <Check size={18} strokeWidth={2.2} aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link to="/anime" className={styles.primary}>
            {S.soon.watchAnime}
          </Link>
          <Link to="/" className={styles.secondary}>
            {S.soon.toHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
