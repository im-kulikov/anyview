import { Link } from 'react-router';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from '../soon/SoonPage.module.css';

export function NotFoundPage() {
  useDocumentTitle(S.notFound.title);
  return (
    <main className={styles.main} style={{ minHeight: '60vh' }}>
      <div className={styles.content} style={{ alignItems: 'center', textAlign: 'center', maxWidth: 520 }}>
        <div className={styles.text}>
          <h1>{S.notFound.title}</h1>
          <p>{S.notFound.body}</p>
        </div>
        <div className={styles.actions} style={{ justifyContent: 'center' }}>
          <Link to="/" className={styles.primary}>
            {S.soon.toHome}
          </Link>
          <Link to="/anime" className={styles.secondary}>
            {S.notFound.toAnime}
          </Link>
        </div>
      </div>
    </main>
  );
}
