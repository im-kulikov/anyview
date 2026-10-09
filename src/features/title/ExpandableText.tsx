import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { S } from '../../lib/strings';
import styles from './ExpandableText.module.css';

/** Описание — только плоский текст (никакого dangerouslySetInnerHTML). */
export function ExpandableText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const ro = new ResizeObserver(() => setOverflow(el.scrollHeight > el.clientHeight + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className={styles.box}>
      <p ref={ref} className={`${styles.text} ${expanded ? '' : styles.clamp}`}>{text}</p>
      {(overflow || expanded) && (
        <button type="button" className={styles.btn} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? S.title.collapse : S.title.readMore}
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
