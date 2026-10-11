import { NavLink, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Cloud, Film, House, Sparkles, Tv } from 'lucide-react';
import { refreshFeed } from '../api/refresh';
import { useNewEpisodes } from '../features/library/useNewEpisodes';
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
  const { pathname } = useLocation();
  const onTitle = pathname.startsWith('/title/');
  const qc = useQueryClient();
  const fresh = useNewEpisodes().size;

  /**
   * Повторный тап по текущей вкладке (как в iOS): прокрутить наверх; уже наверху на ленте — обновить её.
   * Навигацию не делаем: иначе в историю добавилась бы копия той же страницы.
   */
  const again = (to: string) => (e: React.MouseEvent) => {
    if (pathname !== to) return;
    e.preventDefault();
    if (window.scrollY > 8) window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    else if (to === '/' || to === '/anime') void refreshFeed(qc);
  };

  return (
    <nav aria-label={S.nav.sections} className={styles.nav}>
      {ITEMS.map(({ to, label, Icon, end, center }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={again(to)}
          className={({ isActive }) =>
            `${styles.item} ${center ? styles.center : ''} ${isActive || (onTitle && to === '/anime') ? styles.active : ''}`
          }
        >
          <span className={styles.pill}>
            <Icon size={center ? 24 : 20} aria-hidden="true" />
            {center && fresh > 0 && <span className={styles.dot} aria-hidden="true">{fresh > 9 ? '9+' : fresh}</span>}
          </span>
          {label}
          {center && fresh > 0 && <span className={styles.sr}>{S.nav.newEpisodes(fresh)}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
