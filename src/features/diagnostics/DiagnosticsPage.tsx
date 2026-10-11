import { BugReport } from '../../components/BugReport';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './DiagnosticsPage.module.css';

/** `/diagnostics`: тот же отчёт, что на экране ошибки, но без сбоя — для случаев «что-то не так, а ошибки нет». */
export function DiagnosticsPage() {
  useDocumentTitle(S.bug.page);
  return (
    <main className={styles.main}>
      <h1>{S.bug.page}</h1>
      <p>{S.bug.pageLead}</p>
      <BugReport />
    </main>
  );
}
