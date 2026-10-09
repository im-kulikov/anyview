import { NavLink, useLocation } from 'react-router';
import { Cloud, Film, House, Sparkles, Tv } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './BottomNav.module.css';

// Центральная кнопка — вход и синхронизация между устройствами (акцентная, приподнятая).
const ITEMS = [
  { to: '/', label: S.nav.home, Icon: House, end: true },
  { to: '/anime', label: S.nav.anime, Icon: Sparkles },
  { to: '/sync', label: S.nav.sync, Icon: Cloud, center: true },
  { to: '/series', label: S.nav.series, Icon: Tv },
  { to: '/movies', label: S.nav.movies, Icon: Film },
];

export function BottomNav() {
  const onTitle = useLocation().pathname.startsWith('/title/');
  return (
    <nav aria-label={S.nav.sections} className={styles.nav}>
      {ITEMS.map(({ to, label, Icon, end, center }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `${styles.item} ${center ? styles.center : ''} ${isActive || (onTitle && to === '/anime') ? styles.active : ''}`
          }
        >
          <span className={styles.pill}>
            <Icon size={center ? 24 : 20} aria-hidden="true" />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
