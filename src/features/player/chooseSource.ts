import type { Source } from '../../api/contract';
import type { Prefs } from '../../lib/storage';

interface Connection { saveData?: boolean; effectiveType?: string }

/** auto: SD при экономии трафика или 2g/3g, иначе HD. В Safari/Firefox navigator.connection нет — там HD. */
export function wantedHeight(quality: Prefs['quality'], conn?: Connection): number {
  if (quality === 'sd') return 480;
  if (quality === 'hd') return 720;
  return conn?.saveData || ['slow-2g', '2g', '3g'].includes(conn?.effectiveType ?? '') ? 480 : 720;
}

export function chooseSource(list: Source[], quality: Prefs['quality']): Source | undefined {
  const conn = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: Connection }).connection;
  const want = wantedHeight(quality, conn);
  return list
    .filter((s) => s.stream)
    .sort((a, b) => Math.abs((a.quality.height ?? 0) - want) - Math.abs((b.quality.height ?? 0) - want))[0];
}
