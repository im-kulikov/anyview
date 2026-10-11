// Расшифровка минифицированного стека из «Скопировать отчёт»: node scripts/decode-stack.mjs [отчёт.txt] [--dist dist]
// Без файла читает stdin. Для каждой строки `…/assets/<чанк>.js:строка:столбец` берёт карту `<чанк>.js.map` (из --dist или по тому же URL).
import { readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';

const args = process.argv.slice(2);
const distAt = args.indexOf('--dist');
const dist = distAt >= 0 ? args.splice(distAt, 2)[1] : null;
const text = readFileSync(args[0] ?? 0, 'utf8');
const maps = new Map();

async function mapFor(url) {
  if (!maps.has(url)) {
    const file = url.replace(/^.*\/assets\//, '');
    let raw;
    try {
      raw = dist ? readFileSync(`${dist}/assets/${file}.map`, 'utf8') : await (await fetch(`${url}.map`)).text();
      maps.set(url, new SourceMap(JSON.parse(raw)));
    } catch {
      maps.set(url, null);
    }
  }
  return maps.get(url);
}

for (const line of text.split('\n')) {
  const m = /(https?:\/\/\S+?\/assets\/[\w.-]+\.js):(\d+):(\d+)/.exec(line);
  const map = m && (await mapFor(m[1]));
  const e = map?.findEntry(Number(m[2]) - 1, Number(m[3]) - 1);
  console.log(e?.originalSource ? `${line.trim()}\n    → ${e.originalSource.replace(/^.*\/src\//, 'src/')}:${e.originalLine + 1}:${e.originalColumn + 1}${e.name ? ` (${e.name})` : ''}` : line);
}
