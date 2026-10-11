import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, type Plugin } from 'vite';

interface Chunk { type: 'chunk'; isEntry: boolean; imports: string[]; viteMetadata?: { importedCss: Set<string> } }
type Bundle = Record<string, Chunk | { type: 'asset' }>;

/** Файлы, без которых оболочка не стартует: входной чанк, его статические импорты и их CSS. Ленивые чанки кешируются при первом запросе. */
export function startupFiles(bundle: Bundle): string[] {
  const out = new Set<string>();
  const add = (name: string): void => {
    const c = bundle[name];
    if (!c || c.type !== 'chunk' || out.has(name)) return;
    out.add(name);
    c.viteMetadata?.importedCss.forEach((css) => out.add(css));
    c.imports.forEach(add);
  };
  for (const [name, c] of Object.entries(bundle)) if (c.type === 'chunk' && c.isEntry) add(name);
  return [...out].sort();
}

/** Воркер, который снимает прежний: при `VITE_SW=off` он остаётся по тому же адресу и вычищает установленные SW и кеши (ADR-39). */
export const KILLER = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())await caches.delete(k);
  await self.registration.unregister();
  for(const c of await self.clients.matchAll({type:'window'}))c.navigate(c.url);
})()));
`;

/** Сборка `dist/sw.js` (без хеша в имени, scope = base) с манифестом оболочки; полноценный воркер или «убийца» по `VITE_SW=off`. */
export function swPlugin(env: { VITE_SW?: string; VITE_BUILD_SHA?: string }, base: string): Plugin {
  let precache: string[] = [];
  let outDir = 'dist';
  let root = '.';
  return {
    name: 'anyview-sw',
    apply: 'build',
    configResolved: (c) => { outDir = resolve(c.root, c.build.outDir); root = c.root; },
    generateBundle(_, bundle) {
      precache = [...startupFiles(bundle as Bundle).map((f) => base + f), `${base}index.html`];
    },
    async closeBundle() {
      mkdirSync(outDir, { recursive: true });
      let code = KILLER;
      if (env.VITE_SW !== 'off') {
        const fonts = readdirSync(resolve(root, 'public/fonts')).filter((f) => f.endsWith('.woff2')).map((f) => `${base}fonts/${f}`);
        const res = await build({
          configFile: false, logLevel: 'silent', publicDir: false, root,
          define: { __VERSION__: JSON.stringify((env.VITE_BUILD_SHA ?? '').slice(0, 7) || 'dev'), __BASE__: JSON.stringify(base), __PRECACHE__: JSON.stringify([...precache, ...fonts].sort()) },
          build: { write: false, minify: true, lib: { entry: resolve(root, 'src/sw/sw.ts'), name: 'sw', formats: ['iife'], fileName: 'sw' } },
        });
        const out = (Array.isArray(res) ? res[0]! : res as { output: { code: string }[] }).output[0]!;
        code = (out as { code: string }).code;
      }
      writeFileSync(resolve(outDir, 'sw.js'), code);
    },
  };
}
