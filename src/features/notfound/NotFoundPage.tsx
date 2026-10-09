import { Link } from 'react-router';
import { SearchX } from 'lucide-react';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import soon from '../soon/SoonPage.module.css';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  useDocumentTitle(S.notFound.title);
  return (
    <main className={`${soon.main} ${styles.main}`}>
      <div className={`${soon.content} ${styles.content}`}>
        <SearchX size={48} aria-hidden="true" className={styles.icon} />
        <div className={soon.text}>
          <h1>{S.notFound.title}</h1>
          <p>{S.notFound.body}</p>
        </div>
        <div className={`${soon.actions} ${styles.actions}`}>
          <Link to="/" className={soon.primary}>
            {S.soon.toHome}
          </Link>
          <Link to="/anime" className={soon.secondary}>
            {S.notFound.toAnime}
          </Link>
        </div>
      </div>
    </main>
  );
}
