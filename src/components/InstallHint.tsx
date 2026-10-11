import { useState } from 'react';
import { Share, X } from 'lucide-react';
import { dismissHint, hintVisible, installKind, readEnv, readHintState } from '../lib/standalone';
import { S } from '../lib/strings';
import styles from './InstallHint.module.css';

/**
 * Одноразовая подсказка для iPhone/iPad в Safari: как добавить сайт на экран «Домой» (на iOS нет системного окна установки).
 * Не показывается в установленном приложении, в Android/десктопе и во встроенных браузерах; после закрытия молчит 30 дней.
 */
export function InstallHint() {
  const [shown, setShown] = useState(() => hintVisible(installKind(readEnv()), readHintState(), Date.now()));
  if (!shown) return null;
  return (
    <aside className={styles.hint} aria-label={S.install.title}>
      <Share size={22} aria-hidden="true" className={styles.icon} />
      <div className={styles.text}>
        <b>{S.install.title}</b>
        <span>{S.install.body}</span>
      </div>
      <button type="button" className={styles.close} aria-label={S.install.close} onClick={() => { dismissHint(); setShown(false); }}>
        <X size={20} aria-hidden="true" />
      </button>
    </aside>
  );
}
