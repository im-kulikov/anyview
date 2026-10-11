import { expect, test } from 'vitest';
import { startupFiles } from './swPlugin';

const chunk = (isEntry: boolean, imports: string[] = [], css: string[] = []) => ({ type: 'chunk' as const, isEntry, imports, viteMetadata: { importedCss: new Set(css) } });

test('стартовый набор: вход, его статические импорты и CSS; ленивые чанки и карты не входят', () => {
  const bundle = {
    'assets/index.js': chunk(true, ['assets/vendor.js'], ['assets/index.css']),
    'assets/vendor.js': chunk(false, ['assets/vendor.js']), // цикл не должен зациклить
    'assets/TitlePage.js': chunk(false, [], ['assets/TitlePage.css']),
    'assets/index.js.map': { type: 'asset' as const },
    'index.html': { type: 'asset' as const },
  };
  expect(startupFiles(bundle)).toEqual(['assets/index.css', 'assets/index.js', 'assets/vendor.js']);
});
