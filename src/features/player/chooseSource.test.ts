import { expect, test } from 'vitest';
import type { Source } from '../../api/contract';
import { chooseSource, wantedHeight } from './chooseSource';

const src = (h: number): Source => ({
  id: `s${h}`, episodeId: 'e', provider: 'x', label: '', quality: { label: String(h), height: h }, audio: [], subtitles: [],
  stream: { kind: 'file', url: 'https://x' },
});

test('auto: сеть и экономия трафика', () => {
  expect(wantedHeight('auto')).toBe(720);
  expect(wantedHeight('auto', { effectiveType: '3g' })).toBe(480);
  expect(wantedHeight('auto', { saveData: true })).toBe(480);
  expect(wantedHeight('auto', { effectiveType: '4g' })).toBe(720);
  expect(wantedHeight('sd', { effectiveType: '4g' })).toBe(480);
});

test('chooseSource берёт ближайшее качество', () => {
  expect(chooseSource([src(480), src(720)], 'hd')?.id).toBe('s720');
  expect(chooseSource([src(480), src(720)], 'sd')?.id).toBe('s480');
  expect(chooseSource([src(480)], 'hd')?.id).toBe('s480');
  expect(chooseSource([], 'hd')).toBeUndefined();
});
