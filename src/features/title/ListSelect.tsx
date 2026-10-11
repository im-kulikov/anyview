import { ChevronDown } from 'lucide-react';
import type { Title } from '../../api/contract';
import { LIST_STATUSES, setStatus, statusesStore, useStore, type ListStatus } from '../../lib/storage';
import { S } from '../../lib/strings';
import styles from './ListSelect.module.css';

/** Список просмотра: нативный `<select>` (на телефоне — системный выбор, шрифт ≥ 16 px против зума iOS). */
export function ListSelect({ title, className = '' }: { title: Title; className?: string }) {
  const value = useStore(statusesStore)[title.id]?.s ?? '';
  return (
    <label className={`${styles.wrap} ${value ? styles.set : ''} ${className}`}>
      <select value={value} aria-label={S.lists.label} onChange={(e) => setStatus(title, (e.target.value || null) as ListStatus | null)}>
        <option value="">{value ? S.lists.remove : S.lists.add}</option>
        {LIST_STATUSES.map((s) => <option key={s} value={s}>{S.lists[s]}</option>)}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </label>
  );
}
