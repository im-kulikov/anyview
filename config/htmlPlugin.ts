import type { HtmlTagDescriptor, Plugin } from 'vite';
import { FEED_PAGE_SIZE } from '../src/api/keys';
import { IMAGE_ORIGIN, lastPath, parseBases } from '../src/api/providers/animevost/urls';

export interface Env { VITE_PROVIDER?: string; VITE_ANIMEVOST_BASES?: string; VITE_API_BASE?: string; VITE_SITE_URL?: string; VITE_FIREBASE_API_KEY?: string; VITE_FIREBASE_PROJECT_ID?: string; VITE_GOOGLE_CLIENT_ID?: string }

/** Подсказки загрузки из той же конфигурации, что читает приложение (SPEC §8): preconnect к API и картинкам + preload первой страницы ленты. */
export function headHints(env: Env): HtmlTagDescriptor[] {
  if ((env.VITE_PROVIDER || 'animevost') !== 'animevost') return [];
  const [first] = parseBases(env.VITE_ANIMEVOST_BASES);
  if (!first) return [];
  const link = (rel: string, attrs: Record<string, string | boolean>): HtmlTagDescriptor => ({ tag: 'link', attrs: { rel, ...attrs }, injectTo: 'head' });
  return [
    link('preconnect', { href: new URL(first).origin, crossorigin: true }),
    link('preconnect', { href: IMAGE_ORIGIN, crossorigin: true }),
    // тот же URL, что запрашивает адаптер для первой страницы (main.tsx → updatesQuery)
    link('preload', { as: 'fetch', href: first + lastPath(1, FEED_PAGE_SIZE), crossorigin: true }),
  ];
}

/** Внешние базы сведений о тайтле (ADR-30): Shikimori и AniList. */
const EXTERNAL = ['https://shikimori.io', 'https://graphql.anilist.co'];

/** Meta-CSP: connect-src строится из баз API, остальное фиксировано (ADR-20). Только в сборке: dev-сервер Vite использует inline-скрипты. */
export function csp(env: Env): string {
  const bases = (env.VITE_PROVIDER || 'animevost') === 'anyview' ? [env.VITE_API_BASE ?? ''] : parseBases(env.VITE_ANIMEVOST_BASES);
  const connect = [...new Set(bases.filter(Boolean).map((b) => new URL(b).origin))];
  // Синхронизация (ADR-28): источники добавляются, только если в сборке задан Firebase; каждый — минимально необходимый.
  const sync = !!(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_GOOGLE_CLIENT_ID);
  const gsi = 'https://accounts.google.com/gsi/';
  return [
    "default-src 'none'",
    `script-src 'self'${sync ? ` ${gsi}client` : ''}`, // скрипт Google Identity Services
    `style-src 'self' 'unsafe-inline'${sync ? ` ${gsi}style` : ''}`, // стиль кнопки GIS
    ...(sync ? [`frame-src ${gsi}`] : []), // iframe кнопки входа
    `connect-src 'self' ${[...connect, ...EXTERNAL, ...(sync ? [gsi, 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com'] : [])].join(' ')}`.trim(), // GIS; Firebase Auth (вход, обновление токена); Firestore REST
    "img-src 'self' https: data:",
    "media-src https: blob:",
    "font-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'none'",
    "object-src 'none'",
  ].join('; ');
}

export function htmlPlugin(env: Env, base: string): Plugin {
  const site = (env.VITE_SITE_URL || `https://im-kulikov.github.io${base}`).replace(/\/*$/, '/');
  let isBuild = false;
  return {
    name: 'anyview-html',
    configResolved: (c) => void (isBuild = c.command === 'build'),
    transformIndexHtml: (html) => ({
      html: html.replaceAll('%SITE_URL%', site),
      tags: [
        ...(isBuild ? [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp(env) }, injectTo: 'head-prepend' as const }] : []),
        ...headHints(env),
      ],
    }),
  };
}

