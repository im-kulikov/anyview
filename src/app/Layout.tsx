import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { Header } from '../components/Header';
import { DesktopHeader } from '../components/DesktopHeader';
import { OfflineBanner } from '../components/OfflineBanner';
import { Footer } from '../components/Footer';
import { BottomNav } from '../components/BottomNav';
import { coldStartTarget, rememberPath } from '../lib/resume';
import { isStandalone } from '../lib/standalone';
import { useIsDesktop } from '../lib/useMediaQuery';
import styles from './Layout.module.css';

/** Корни вкладок нижней панели: прокрутка каждой хранится по пути, а не по записи истории — вернувшись на вкладку, оказываешься там, где ушёл. */
const TAB_ROOTS = new Set(['/', '/anime', '/sync', '/series', '/movies']);

export function Layout() {
  const isDesktop = useIsDesktop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const first = useRef(true);
  const searchMode = pathname === '/search';
  useEffect(() => {
    const target = first.current && isStandalone() ? coldStartTarget(pathname) : null;
    first.current = false;
    if (target) void navigate(target); // не replace: «Назад» ведёт на главную
    else rememberPath(pathname);
  }, [pathname, navigate]);
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
