import { Link, useLocation, useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { Logo } from './Logo';
import { SearchField } from './SearchField';
import { S } from '../lib/strings';
import styles from './Header.module.css';

/** Мобильная шапка. Слот слева меняет содержимое, а SearchField остаётся на месте. */
export function Header() {
  const { pathname, key } = useLocation();
  const navigate = useNavigate();
  const searchMode = pathname === '/search';
  return (
    <header className={styles.header}>
      <div className={styles.slot}>
        {searchMode ? (
          <Link
            to="/"
            className={styles.back}
            aria-label={S.search.close}
            onClick={(e) => {
              // «Назад» ведёт туда, откуда пришли; без истории — на главную.
              if (key !== 'default') {
                e.preventDefault();
                navigate(-1);
              }
            }}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        ) : (
          <Logo />
        )}
      </div>
      <SearchField active={searchMode} />
    </header>
  );
}
