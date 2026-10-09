import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { S } from '../lib/strings';
import styles from './Rail.module.css';

/** Горизонтальная лента: свайп и scroll-snap; на десктопе — кнопки «‹ ›» при наведении. */
export function Rail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  useEffect(update, [update, children]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    el?.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <div className={styles.wrap}>
      <div ref={ref} className={styles.rail} onScroll={update}>
        {children}
      </div>
      {edge.left && (
        <button type="button" className={`${styles.arrow} ${styles.prev}`} aria-label={S.rail.prev} onClick={() => scroll(-1)}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      )}
      {edge.right && (
        <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={S.rail.next} onClick={() => scroll(1)}>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
