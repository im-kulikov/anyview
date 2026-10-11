import { NavLink, useLocation } from 'react-router';
import { Cloud } from 'lucide-react';
import { Logo } from './Logo';
import { SearchField } from './SearchField';
import { S } from '../lib/strings';
import styles from './DesktopHeader.module.css';

const ITEMS = [
  { to: '/', label: S.nav.home, end: true },
  { to: '/anime', label: S.nav.anime },
  { to: '/series', label: S.nav.series, soon: true },
  { to: '/movies', label: S.nav.movies, soon: true },
];

export function DesktopHeader() {
  // На странице тайтла раздел «Аниме» подсвечен (как в макете и в BottomNav), aria-current — только у точного совпадения.
  const onTitle = useLocation().pathname.startsWith('/title/');
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo size={34} />
        <nav aria-label={S.nav.sections} className={styles.nav}>
          {ITEMS.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => `${styles.link} ${isActive || (onTitle && it.to === '/anime') ? styles.active : ''}`}
            >
              {it.label}
              {it.soon && <span className={styles.badge}>{S.nav.soonBadge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={styles.search}>
          <SearchField active={false} />
        </div>
        <NavLink to="/sync" aria-label={S.sync.navLabel} title={S.sync.navLabel} className={({ isActive }) => `${styles.icon} ${isActive ? styles.active : ''}`}>
          <Cloud size={20} aria-hidden="true" />
        </NavLink>
      </div>
    </header>
  );
}
