// Стартовые экраны iPhone (apple-touch-startup-image): фон #131416, марка по центру.
// Запуск: E2E_CHROMIUM=/путь/к/chrome node scripts/gen-splash.mjs — пишет public/splash/*.png и печатает <link> для index.html.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const DEVICES = [ // [ширина pt, высота pt, ratio]
  [440, 956, 3], [430, 932, 3], [428, 926, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2],
];
const mark = readFileSync('public/brand/logo-mark.svg', 'utf8');
mkdirSync('public/splash', { recursive: true });
const browser = await chromium.launch(process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {});
for (const [w, h, r] of DEVICES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
  await page.setContent(`<body style="margin:0;background:#131416;display:grid;place-items:center;height:100vh"><div style="width:96px;height:96px">${mark}</div></body>`);
  await page.screenshot({ path: `public/splash/${w * r}x${h * r}.png` });
  await page.close();
  console.log(`    <link rel="apple-touch-startup-image" href="%BASE_URL%splash/${w * r}x${h * r}.png" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" />`);
}
await browser.close();
