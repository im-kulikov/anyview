import { CircleAlert } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './ErrorState.module.css';

export function ErrorState({ title = S.common.somethingWrong, hint = S.common.tryLater, onRetry }: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.box} role="alert">
      <CircleAlert size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{hint}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={styles.btn}>
          {S.common.retry}
        </button>
      )}
    </div>
  );
}
