import { Outlet, ScrollRestoration, useLocation } from 'react-router';
import { Header } from '../components/Header';
import { DesktopHeader } from '../components/DesktopHeader';
import { OfflineBanner } from '../components/OfflineBanner';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './Layout.module.css';

/** Корни вкладок нижней панели: прокрутка каждой хранится по пути, а не по записи истории — вернувшись на вкладку, оказываешься там, где ушёл. */
const TAB_ROOTS = new Set(['/', '/anime', '/sync', '/series', '/movies']);

export function Layout() {
  const isDesktop = useIsDesktop();
  const searchMode = useLocation().pathname === '/search';
  const showNav = !isDesktop && !searchMode;
  return (
    <div className={styles.app} data-nav={showNav ? 'on' : 'off'}>
      {isDesktop ? <DesktopHeader /> : <Header />}
      <Outlet />
      <Footer />
      <OfflineBanner />
      {showNav && <BottomNav />}
      <ScrollRestoration getKey={(loc) => (TAB_ROOTS.has(loc.pathname) ? loc.pathname : loc.key)} />
    </div>
  );
}
