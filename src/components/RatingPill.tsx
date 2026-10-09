import { Star } from 'lucide-react';
import { ratingText } from '../lib/format';
import styles from './RatingPill.module.css';

export function RatingPill({ value }: { value: number }) {
  return (
    <span className={styles.pill}>
      <Star size={12} fill="var(--star)" stroke="none" aria-hidden="true" />
      {ratingText(value)}
    </span>
  );
}
