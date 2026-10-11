import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router';
import { S } from '../lib/strings';
import { report } from '../lib/report';
import { resetLocalData } from '../lib/storage';
import { ErrorState } from '../components/ErrorState';
import styles from './ErrorBoundary.module.css';

/**
 * Глобальный errorElement маршрута. Отчёт уходит в `report` и в проде тоже (раньше — только в dev: сбой рендера не оставлял следа).
 * Выходы без перезагрузки на тот же сбой: «На главную» и «Сбросить локальные данные» (двухшаговое подтверждение) —
 * если экран падает из-за данных в localStorage, перезагрузка сама не поможет.
 */
export function RouteError() {
  const err = useRouteError();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => report(err, 'route'), [err]);
  return (
    <main>
      <ErrorState title={S.boundary.title} hint={S.boundary.hint} onRetry={() => location.reload()} />
      <div className={styles.recover}>
        <a href={import.meta.env.BASE_URL} className={styles.link}>{S.boundary.home}</a>
        {confirming ? (
          <div role="group" aria-label={S.boundary.reset} className={styles.confirm}>
            <p>{S.boundary.resetHint}</p>
            <button type="button" className={styles.danger} onClick={() => { resetLocalData(); location.assign(import.meta.env.BASE_URL); }}>{S.boundary.resetYes}</button>
            <button type="button" className={styles.link} onClick={() => setConfirming(false)}>{S.boundary.resetNo}</button>
          </div>
        ) : (
          <button type="button" className={styles.link} onClick={() => setConfirming(true)}>{S.boundary.reset}</button>
        )}
      </div>
    </main>
  );
}
