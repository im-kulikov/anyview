import { describe, expect, test } from 'vitest';
import { hintVisible, HINT_SNOOZE_MS, installKind, isIos, type Env } from './standalone';

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const env = (o: Partial<Env>): Env => ({ ua: IPHONE_SAFARI, platform: 'iPhone', touchPoints: 5, standalone: false, ...o });

describe('installKind', () => {
  test('iPhone Safari → safari', () => expect(installKind(env({}))).toBe('safari'));
  test('уже установлено → null', () => expect(installKind(env({ standalone: true }))).toBeNull());
  test('не iOS (Android, десктоп) → null', () => {
    expect(installKind(env({ ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36', platform: 'Linux armv8l' }))).toBeNull();
    expect(installKind(env({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', platform: 'MacIntel', touchPoints: 0 }))).toBeNull();
  });
  test('iPad в режиме «как на компьютере» (Mac + мультитач) → safari', () =>
    expect(installKind(env({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', platform: 'MacIntel', touchPoints: 5 }))).toBe('safari'));
  test('Chrome/Firefox/Edge на iOS → other-ios', () => {
    for (const marker of ['CriOS/120.0', 'FxiOS/120.0', 'EdgiOS/120.0']) expect(installKind(env({ ua: `${IPHONE_SAFARI} ${marker}` }))).toBe('other-ios');
  });
  test('встроенные браузеры (Facebook, Instagram, Line) → null', () => {
    for (const marker of ['FBAN/FBIOS', 'Instagram 300.0', 'Line/13.0']) expect(installKind(env({ ua: `${IPHONE_SAFARI} ${marker}` }))).toBeNull();
  });
  test('isIos: пустое окружение (SSR, ошибка чтения) — не iOS', () => expect(isIos({ ua: '', platform: '', touchPoints: 0, standalone: false })).toBe(false));
});

describe('hintVisible', () => {
  const now = 1_000_000_000_000;
  test('нет вида подсказки — не показываем', () => expect(hintVisible(null, {}, now)).toBe(false));
  test('ни разу не закрывали — показываем', () => expect(hintVisible('safari', {}, now)).toBe(true));
  test('закрыли недавно — молчим, через 30 дней — снова', () => {
    expect(hintVisible('safari', { dismissedAt: now - 1000 }, now)).toBe(false);
    expect(hintVisible('safari', { dismissedAt: now - HINT_SNOOZE_MS + 1 }, now)).toBe(false);
    expect(hintVisible('safari', { dismissedAt: now - HINT_SNOOZE_MS }, now)).toBe(true);
  });
});
