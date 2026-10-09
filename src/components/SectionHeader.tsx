import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import styles from './SectionHeader.module.css';

/** Телефон — круглая стрелка 44 px, десктоп — таблетка с текстом. */
export function SectionHeader({ title, to, label, text }: { title: string; to?: string; label?: string; text?: string }) {
  return (
    <div className={styles.row}>
      <h2>{title}</h2>
      {to && (
        <Link to={to} aria-label={label ?? text} className={styles.link}>
          {text && <span className={styles.text}>{text}</span>}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
