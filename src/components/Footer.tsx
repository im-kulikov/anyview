import { Link } from 'react-router';
import { S } from '../lib/strings';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div>
        <span>{S.footer.left}</span>
        <Link to="/sync" className={styles.link}>
          {S.footer.sync}
        </Link>
        <span>{S.footer.right}</span>
      </div>
    </footer>
  );
}
