import { describe, expect, test } from 'vitest';
import { IMAGE_MIRROR, imageUrls } from './urls';

const P = '/uploads/posts/2026-09/1789626347_1.jpg';
const wsrv = (src: string) => `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=480&we&output=webp&q=75`;

describe('imageUrls', () => {
  test('static.openni.ru: wsrv с запасным источником, зеркало, оригинал (формат зафиксирован: он ключ HTTP-кеша)', () => {
    expect(imageUrls(`https://static.openni.ru${P}`)).toEqual([
      `${wsrv('https://animevost.org' + P)}&default=${encodeURIComponent(wsrv('http://static.openni.ru' + P))}`,
      `${IMAGE_MIRROR}${P}`,
      `https://animevost.org${P}`,
    ]);
    expect(IMAGE_MIRROR).toBe('https://v14.vost.pw');
  });

  test('хосты animevost.org и *.vost.pw дают тот же набор, query сохраняется', () => {
    const base = imageUrls(`https://static.openni.ru${P}?v=2`);
    expect(imageUrls(`https://animevost.org${P}?v=2`)).toEqual(base);
    expect(imageUrls(`https://v13.vost.pw${P}?v=2`)).toEqual(base);
    expect(imageUrls(`http://static.openni.ru${P}?v=2`)).toEqual(base);
    expect(base[1]).toBe(`${IMAGE_MIRROR}${P}?v=2`);
  });

  test('чужие хосты и пути не из /uploads/ — как есть', () => {
    for (const u of ['https://media.test/p.png', 'https://static.openni.ru/other/x.jpg', 'https://evilvost.pw/uploads/x.jpg', 'https://static.openni.ru.evil.test/uploads/x.jpg', 'https://wsrv.nl/?url=x']) {
      expect(imageUrls(u)).toEqual([u]);
    }
  });

  test('мусорный ввод не падает', () => {
    for (const u of ['', ' ', 'not a url', '//static.openni.ru/uploads/x.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'https://', '\u0000', '/uploads/x.jpg']) {
      expect(imageUrls(u)).toEqual([u]);
    }
  });
});
