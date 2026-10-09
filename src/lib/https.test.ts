import { expect, test } from 'vitest';
import { https } from './https';

test('https() переписывает http', () => {
  expect(https('http://video.animetop.info/a.mp4')).toBe('https://video.animetop.info/a.mp4');
  expect(https('https://x/y')).toBe('https://x/y');
  expect(https('http://x:8080/y')).toBe('https://x:8080/y');
});

test('относительные адреса разрешаются от base, без base — undefined', () => {
  expect(https('/uploads/a.jpg', 'https://static.test')).toBe('https://static.test/uploads/a.jpg');
  expect(https('//cdn.test/a.jpg', 'https://static.test')).toBe('https://cdn.test/a.jpg');
  expect(https('/uploads/a.jpg')).toBeUndefined();
});

test('чужие схемы и мусор отбрасываются', () => {
  expect(https('javascript:alert(1)')).toBeUndefined();
  expect(https('data:image/png;base64,AAAA')).toBeUndefined();
  expect(https('ftp://x/a')).toBeUndefined();
  expect(https('')).toBeUndefined();
});
