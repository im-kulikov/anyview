import { useRef, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { buildBugReport } from '../lib/bugReport';
import { S } from '../lib/strings';
import styles from './BugReport.module.css';

/**
 * «Скопировать отчёт»: собирает текст о проблеме (версия, страница, ошибка, форма данных) и кладёт в буфер обмена, чтобы
 * вставить его в чат без консоли браузера. Текст виден в раскрывающемся блоке: если буфер недоступен, его можно выделить вручную.
 */
export function BugReport({ error }: { error?: unknown }) {
  const [withData, setWithData] = useState(false);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const area = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(() => buildBugReport({ error }));

  const refresh = (includeData: boolean) => {
    setWithData(includeData);
    setText(buildBugReport({ error, includeData }));
    setState('idle');
  };

  const copy = async () => {
    const fresh = buildBugReport({ error, includeData: withData });
    setText(fresh);
    try {
      await navigator.clipboard.writeText(fresh);
      setState('copied');
    } catch {
      // нет доступа к буферу (http, запрет, старый браузер): выделяем текст, пользователь копирует сам
      area.current?.focus();
      area.current?.select();
      setState('manual');
    }
  };

  return (
    <section className={styles.box} aria-label={S.bug.title}>
      <button type="button" className={styles.copy} onClick={() => void copy()}>
        {state === 'copied' ? <Check size={20} aria-hidden="true" /> : <ClipboardCopy size={20} aria-hidden="true" />}
        {state === 'copied' ? S.bug.copied : S.bug.copy}
      </button>
      <p role="status" className={styles.note}>{state === 'manual' ? S.bug.manual : S.bug.hint}</p>
      <label className={styles.check}>
        <input type="checkbox" checked={withData} onChange={(e) => refresh(e.target.checked)} />
        {S.bug.withData}
      </label>
      <details className={styles.details}>
        <summary>{S.bug.show}</summary>
        <textarea ref={area} readOnly value={text} className={styles.text} aria-label={S.bug.title} rows={12} />
      </details>
    </section>
  );
}
