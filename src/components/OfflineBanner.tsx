import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './OfflineBanner.module.css';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className={styles.banner}>
      <WifiOff size={16} aria-hidden="true" />
      {S.offline}
    </div>
  );
}
