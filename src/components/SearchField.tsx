import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';
import { S } from '../lib/strings';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './SearchField.module.css';

/**
 * Один <input> живёт в Layout и не перемонтируется при переходе на /search:
 * на iOS фокус и клавиатура сохраняются только так (SPEC §5.6).
 */
export function SearchField({ active }: { active: boolean }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const { pathname, state } = useLocation();
  const navType = useNavigationType();
  const [params] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const isSearch = pathname === '/search';
  const urlQ = isSearch ? (params.get('q') ?? '') : '';

  const [value, setValue] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    // Свои обновления URL не затираем (иначе быстрый ввод откатывается), «Назад»/«Вперёд» — синхронизируем.
    if (navType === 'POP' || !state?.fromField) setValue(urlQ);
  }

  const go = (q: string) => {
    const url = `/search${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    // Первый переход — в историю (чтобы «Назад» вернул на предыдущий экран), дальше — replace.
    navigate(url, { replace: isSearch, preventScrollReset: true, state: { fromField: true } });
  };

  useEffect(() => {
    if (!isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isDesktop]);

  return (
    <label className={`${styles.field} ${active ? styles.active : ''}`}>
      <Search size={18} aria-hidden="true" className={styles.icon} />
      <span className={styles.sr}>{S.search.label}</span>
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        placeholder={active ? S.search.placeholderFull : S.search.placeholder}
        className={styles.input}
        // iOS: фокус и переход — синхронно в обработчике касания.
        onFocus={() => {
          if (!isDesktop && !isSearch) go('');
        }}
        onChange={(e) => {
          setValue(e.target.value);
          go(e.target.value);
        }}
      />
      {value ? (
        <button
          type="button"
          className={styles.clear}
          aria-label={S.search.clear}
          onClick={() => {
            setValue('');
            go('');
            inputRef.current?.focus();
          }}
        >
          <span>
            <X size={14} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </button>
      ) : (
        isDesktop && <kbd className={styles.kbd}>/</kbd>
      )}
    </label>
  );
}
