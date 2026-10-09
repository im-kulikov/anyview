import { S } from '../lib/strings';
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div>
        <span>{S.footer.left}</span>
        <span>{S.footer.right}</span>
      </div>
    </footer>
  );
}
