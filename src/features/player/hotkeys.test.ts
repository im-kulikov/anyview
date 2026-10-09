import { describe, expect, test } from 'vitest';
import { keyAction, type KeyInput } from './hotkeys';

const base: KeyInput = { key: ' ', shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, inField: false, onInteractive: false, inPlayer: true, playingOnBody: false };
const k = (o: Partial<KeyInput>) => keyAction({ ...base, ...o });

describe('keyAction', () => {
  test('базовые клавиши', () => {
    expect(k({ key: ' ' })).toEqual({ type: 'toggle' });
    expect(k({ key: 'K' })).toEqual({ type: 'toggle' });
    expect(k({ key: 'ArrowLeft' })).toEqual({ type: 'seek', delta: -10 });
    expect(k({ key: 'ArrowRight' })).toEqual({ type: 'seek', delta: 10 });
    expect(k({ key: 'ArrowUp' })).toEqual({ type: 'volume', delta: 0.1 });
    expect(k({ key: 'ArrowDown' })).toEqual({ type: 'volume', delta: -0.1 });
    expect(k({ key: 'f' })).toEqual({ type: 'fullscreen' });
    expect(k({ key: 'm' })).toEqual({ type: 'mute' });
    expect(k({ key: 'N', shiftKey: true })).toEqual({ type: 'next' });
  });
  test('в полях ввода не срабатывает', () => {
    for (const key of [' ', 'k', 'f', 'm', 'ArrowLeft']) expect(k({ key, inField: true })).toBeNull();
    expect(k({ key: 'N', shiftKey: true, inField: true })).toBeNull();
  });
  test('на кнопке пробел и стрелки остаются за кнопкой', () => {
    expect(k({ key: ' ', onInteractive: true })).toBeNull();
    expect(k({ key: 'ArrowLeft', onInteractive: true })).toBeNull();
    expect(k({ key: 'ArrowUp', onInteractive: true })).toBeNull();
    expect(k({ key: 'f', onInteractive: true })).toEqual({ type: 'fullscreen' });
  });
  test('с модификаторами и Shift (кроме Shift+N) не срабатывает', () => {
    expect(k({ key: 'f', ctrlKey: true })).toBeNull();
    expect(k({ key: 'k', metaKey: true })).toBeNull();
    expect(k({ key: 'm', altKey: true })).toBeNull();
    expect(k({ key: 'ArrowLeft', shiftKey: true })).toBeNull();
  });
  test('вне плеера — только пока видео играет и фокус на body', () => {
    expect(k({ inPlayer: false })).toBeNull();
    expect(k({ inPlayer: false, playingOnBody: true })).toEqual({ type: 'toggle' });
  });
  test('прочие клавиши не трогаем', () => {
    expect(k({ key: 'a' })).toBeNull();
    expect(k({ key: 'Enter' })).toBeNull();
  });
});
