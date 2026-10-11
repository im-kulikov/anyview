import { useState } from 'react';
import { BugReport } from '../../components/BugReport';
import { resetSwCache } from '../../lib/sw';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './DiagnosticsPage.module.css';

/** `/diagnostics`: тот же отчёт, что на экране ошибки, но без сбоя — для случаев «что-то не так, а ошибки нет». */
export function DiagnosticsPage() {
  useDocumentTitle(S.bug.page);
  const [done, setDone] = useState(false);
  return (
    <main className={styles.main}>
      <h1>{S.bug.page}</h1>
      <p>{S.bug.pageLead}</p>
      <BugReport />
      <h2>{S.bug.cacheTitle}</h2>
      <p>{S.bug.cacheLead}</p>
      <button type="button" className={styles.reset} onClick={() => void resetSwCache().then(() => setDone(true))}>{done ? S.bug.cacheDone : S.bug.cacheReset}</button>
    </main>
  );
}
