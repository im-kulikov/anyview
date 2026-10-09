// Бюджет SPEC §8: стартовый JS (скрипт, подключённый в dist/index.html) ≤ 150 КБ gzip. Запуск после `npm run build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 150;
const html = readFileSync('dist/index.html', 'utf8');
const src = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1];
if (!src) throw new Error('В dist/index.html не найден модульный скрипт');
const file = 'dist/' + src.replace(/^.*?\/assets\//, 'assets/');
const kb = gzipSync(readFileSync(file)).length / 1000;
console.log(`${file}: ${kb.toFixed(1)} КБ gzip (бюджет ${BUDGET_KB})`);
if (kb > BUDGET_KB) {
  console.error('Бюджет стартового JS превышен');
  process.exit(1);
}
