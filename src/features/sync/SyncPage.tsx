import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Cloud, CloudOff } from 'lucide-react';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { deleteCloudData, getSyncState, renderSignIn, retry, signOut, start, subscribeSyncState } from '../../sync/engine';
import styles from './SyncPage.module.css';

const time = (t: number) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Экран `/sync` (SPEC §5.8). Код провайдера (Firebase, Google) грузится только после «Включить синхронизацию» или при уже выполненном входе. */
export function SyncPage() {
  useDocumentTitle(S.sync.title);
  const st = useSyncExternalStore(subscribeSyncState, getSyncState);
  const [wantButton, setWantButton] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => start(), []);
  useEffect(() => {
    if (wantButton && !st.user && buttonRef.current) void renderSignIn(buttonRef.current);
  }, [wantButton, st.user]);

  const who = st.user?.email ?? st.user?.name ?? '';
  const pendingKnown = st.available && !st.known && !wantButton && localStorage.getItem('anyview:sync') === '1';

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <div className={styles.icon} aria-hidden="true">
          {st.available ? <Cloud size={32} /> : <CloudOff size={32} />}
        </div>
        <h1>{st.available ? S.sync.title : S.sync.unavailable}</h1>
        <p className={styles.lead}>{st.available ? S.sync.lead : S.sync.unavailableBody}</p>

        {st.available && (
          <>
            <section aria-labelledby="sync-what" className={styles.card}>
              <h2 id="sync-what">{S.sync.what}</h2>
              <ul>
                {S.sync.whatItems.map((t) => (
                  <li key={t}>
                    <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.card} aria-label={S.sync.title}>
              {/* Область статуса существует всегда: скринридер объявляет изменения */}
              <p className={styles.status} role="status" aria-live="polite">
                {st.user
                  ? st.syncing
                    ? S.sync.syncing
                    : st.error
                      ? ''
                      : st.lastSync
                        ? S.sync.last(time(st.lastSync))
                        : S.sync.never
                  : st.loading
                    ? S.sync.loading
                    : pendingKnown
                      ? S.sync.checking
                      : ''}
              </p>
              {st.error && (
                <p className={styles.error} role="alert">
                  {S.sync.errors[st.error]}
                </p>
              )}

              {st.user ? (
                <>
                  <p className={styles.who}>{S.sync.signedInAs(who)}</p>
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} disabled={st.syncing} onClick={() => void retry()}>
                      {st.error ? S.sync.retry : S.sync.syncNow}
                    </button>
                    <button type="button" className={styles.secondary} onClick={() => void signOut()}>
                      {S.sync.signOut}
                    </button>
                  </div>
                  <p className={styles.hint}>{S.sync.signedOutNote}</p>
                  {confirming ? (
                    <div className={styles.confirm} role="group" aria-label={S.sync.deleteCloud}>
                      <p>{S.sync.deleteConfirm}</p>
                      <div className={styles.actions}>
                        <button type="button" className={styles.danger} onClick={() => void deleteCloudData().then(() => setConfirming(false))}>
                          {S.sync.deleteYes}
                        </button>
                        <button type="button" className={styles.secondary} onClick={() => setConfirming(false)}>
                          {S.sync.deleteNo}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={styles.linkButton} onClick={() => setConfirming(true)}>
                      {S.sync.deleteCloud}
                    </button>
                  )}
                </>
              ) : wantButton ? (
                <div ref={buttonRef} className={styles.google} aria-label={S.sync.googleButton} />
              ) : (
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} onClick={() => setWantButton(true)}>
                    {S.sync.enable}
                  </button>
                </div>
              )}
            </section>

            <section aria-labelledby="sync-privacy" className={styles.card}>
              <h2 id="sync-privacy">{S.sync.privacyTitle}</h2>
              {S.sync.privacy.map((t) => (
                <p key={t} className={styles.hint}>
                  {t}
                </p>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
