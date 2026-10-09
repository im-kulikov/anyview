import { NavLink, useLocation } from 'react-router';
import { Film, House, Sparkles, Tv } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './BottomNav.module.css';

const ITEMS = [
  { to: '/', label: S.nav.home, Icon: House, end: true },
  { to: '/anime', label: S.nav.anime, Icon: Sparkles },
  { to: '/series', label: S.nav.series, Icon: Tv },
  { to: '/movies', label: S.nav.movies, Icon: Film },
];

export function BottomNav() {
  const onTitle = useLocation().pathname.startsWith('/title/');
  return (
    <nav aria-label={S.nav.sections} className={styles.nav}>
      {ITEMS.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `${styles.item} ${isActive || (onTitle && to === '/anime') ? styles.active : ''}`}
          aria-current={onTitle && to === '/anime' ? 'page' : undefined}
        >
          <span className={styles.pill}>
            <Icon size={20} aria-hidden="true" />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
