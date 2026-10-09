import { expect, test } from 'vitest';
import { https } from './https';

test('https() переписывает http', () => {
  expect(https('http://video.animetop.info/a.mp4')).toBe('https://video.animetop.info/a.mp4');
  expect(https('https://x/y')).toBe('https://x/y');
});
