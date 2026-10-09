import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router';
import { Search, X } from 'lucide-react';
import { S } from '../lib/strings';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './SearchField.module.css';

const URL_DELAY = 250;

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

  // Свой <input> обновляет URL с задержкой: иначе History API вызывается на каждую клавишу (лимит WebKit ~100 за 30 с).
  // Локальное значение при этом обновляется сразу.
  const timer = useRef(0);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = (q: string) => {
    window.clearTimeout(timer.current);
    const url = `/search${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    // Первый переход — в историю (чтобы «Назад» вернул на предыдущий экран), дальше — replace.
    navigate(url, { replace: isSearch, preventScrollReset: isSearch, state: { fromField: true } });
  };

  const goLater = (q: string) => {
    // Первый переход на /search — сразу (запись в историю, у iOS синхронно в касании); дальше — после паузы в наборе.
    if (!isSearch) return go(q);
    window.clearTimeout(timer.current);
    // Если за паузу ушли со страницы поиска (ссылка, «Назад»), возвращать на /search не нужно.
    timer.current = window.setTimeout(() => pathRef.current === '/search' && go(q), URL_DELAY);
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
    <div className={`${styles.field} ${active ? styles.active : ''}`}>
      <label className={styles.label}>
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
            goLater(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isSearch) go(value);
          }}
        />
      </label>
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
    </div>
  );
}
