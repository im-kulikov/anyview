import { NavLink, useLocation } from 'react-router';
import { Bookmark, Clapperboard, Cloud, House, Sparkles } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './BottomNav.module.css';

// Центральная кнопка — вход и синхронизация между устройствами (акцентная, приподнятая).
const ITEMS = [
  { to: '/', label: S.nav.home, Icon: House, end: true },
  { to: '/anime', label: S.nav.anime, Icon: Sparkles },
  { to: '/sync', label: S.nav.sync, Icon: Cloud, center: true },
  { to: '/library', label: S.nav.library, Icon: Bookmark },
  { to: '/series', label: S.nav.soon, Icon: Clapperboard, also: '/movies' },
];

export function BottomNav() {
  const path = useLocation().pathname;
  const onTitle = path.startsWith('/title/');
  return (
    <nav aria-label={S.nav.sections} className={styles.nav}>
      {ITEMS.map(({ to, label, Icon, end, center, also }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `${styles.item} ${center ? styles.center : ''} ${isActive || (onTitle && to === '/anime') || (!!also && path === also) ? styles.active : ''}`
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
