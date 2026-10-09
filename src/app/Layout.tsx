import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Header } from '../components/Header';
import { DesktopHeader } from '../components/DesktopHeader';
import { BottomNav } from '../components/BottomNav';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './Layout.module.css';

export function Layout() {
  const isDesktop = useIsDesktop();
  const searchMode = useLocation().pathname === '/search';
  const showNav = !isDesktop && !searchMode;
  return (
    <div className={styles.app} data-nav={showNav ? 'on' : 'off'}>
      {isDesktop ? <DesktopHeader /> : <Header />}
      <Outlet />
      {showNav && <BottomNav />}
      <ScrollRestoration />
    </div>
  );
}
