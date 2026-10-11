import { useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { S } from '../lib/strings';
import { subscribeUpdate, updateAvailable } from '../lib/update';
import styles from './OfflineBanner.module.css';

/** Показывается, только когда обновление нашли во время просмотра: иначе страница перезагружается сама. */
export function UpdateBanner() {
  const show = useSyncExternalStore(subscribeUpdate, updateAvailable, () => false);
  if (!show) return null;
  return (
    <div role="status" className={styles.banner}>
      <RefreshCw size={16} aria-hidden="true" />
      {S.update.text}
      <button type="button" className={styles.action} onClick={() => location.reload()}>{S.update.action}</button>
    </div>
  );
}
