import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Cloud, CloudCheck, CloudOff } from 'lucide-react';
import { SectionTitle } from '../../components/SectionTitle';
import { S } from '../../lib/strings';
import { LibrarySection } from '../library/LibrarySection';
import { rowKind } from './accountStatus';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { deleteCloudData, flag, getSyncState, renderSignIn, retry, signOut, start, subscribeSyncState } from '../../sync/engine';
import styles from './SyncPage.module.css';

const time = (t: number) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** Экран `/sync` — «Аккаунт» (SPEC §5.8): сверху «Моё», ниже синхронизация. Код провайдера (Firebase, Google) грузится только после «Включить синхронизацию» или при уже выполненном входе. */
export function SyncPage() {
  useDocumentTitle(S.sync.accountTitle);
  const st = useSyncExternalStore(subscribeSyncState, getSyncState);
  const [wantButton, setWantButton] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => start(), []);
  useEffect(() => {
    if (wantButton && !st.user && buttonRef.current) void renderSignIn(buttonRef.current);
  }, [wantButton, st.user]);

  const who = st.user?.email ?? st.user?.name ?? '';
  const pendingKnown = st.available && !st.known && !wantButton && flag.get();
  const kind = rowKind({ available: st.available, signedIn: !!st.user, loading: st.loading, checking: pendingKnown, syncing: st.syncing, error: !!st.error, lastSync: st.lastSync });
  const HeadIcon = !st.available ? CloudOff : st.user && !st.error && st.lastSync ? CloudCheck : Cloud;

  // К секции синхронизации: прокрутка с учётом sticky-шапки (scroll-margin) и фокус на заголовок
  const toSync = () => {
    const el = document.getElementById('sync');
    el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    document.getElementById('sync-h')?.focus({ preventScroll: true });
  };
  const rowText = kind === 'ok' ? S.sync.row.ok(time(st.lastSync ?? 0)) : kind ? S.sync.row[kind] : '';

  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <h1 className={styles.account}>{S.sync.accountTitle}</h1>
        {kind && (
          <p className={styles.summary}>
            <HeadIcon size={18} aria-hidden="true" />
            <span>{rowText}</span>
            {(kind === 'off' || kind === 'error') && (
              <button type="button" className={styles.linkButton} onClick={() => { if (kind === 'off') setWantButton(true); toSync(); }}>
                {kind === 'off' ? S.sync.row.enable : S.sync.row.details}
              </button>
            )}
          </p>
        )}

        <LibrarySection />

        <section id="sync" className={styles.syncSection} aria-labelledby="sync-h">
          <div className={styles.syncBody}>
            <SectionTitle id="sync-h" icon={HeadIcon} focusTarget>{st.available ? S.sync.title : S.sync.unavailable}</SectionTitle>
            <p className={styles.lead}>{st.available ? S.sync.lead : S.sync.unavailableBody}</p>

            {st.available && (
              <>
                {/* Действие первым: на телефоне кнопка входа не должна уезжать под объяснения */}
                <div className={styles.card}>
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
                </div>

                <div className={styles.card} role="group" aria-labelledby="sync-what">
                  <h3 id="sync-what">{S.sync.what}</h3>
                  <ul>
                    {S.sync.whatItems.map((t) => (
                      <li key={t}>
                        <Check size={18} strokeWidth={2.2} aria-hidden="true" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={styles.card} role="group" aria-labelledby="sync-privacy">
                  <h3 id="sync-privacy">{S.sync.privacyTitle}</h3>
                  {S.sync.privacy.map((t) => (
                    <p key={t} className={styles.hint}>
                      {t}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
