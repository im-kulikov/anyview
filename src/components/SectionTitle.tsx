import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './SectionTitle.module.css';

/** Заголовок секции страницы: иконка и текст в одной строке (h2). Иконка декоративная — имя секции даёт текст. */
export function SectionTitle({ id, icon: Icon, focusTarget, children }: { id: string; icon: LucideIcon; /** Можно сфокусировать программно (переход из строки статуса к секции). */ focusTarget?: boolean; children: ReactNode }) {
  return (
    <h2 id={id} className={styles.title} tabIndex={focusTarget ? -1 : undefined}>
      <Icon size={24} aria-hidden="true" className={styles.icon} />
      <span>{children}</span>
    </h2>
  );
}
