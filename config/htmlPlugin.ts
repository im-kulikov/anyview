import type { HtmlTagDescriptor, Plugin } from 'vite';
import { FEED_PAGE_SIZE } from '../src/api/keys';
import { IMAGE_ORIGIN, lastPath, parseBases } from '../src/api/providers/animevost/urls';

export interface Env { VITE_PROVIDER?: string; VITE_ANIMEVOST_BASES?: string; VITE_API_BASE?: string; VITE_SITE_URL?: string }

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

/** Meta-CSP: connect-src строится из баз API, остальное фиксировано (ADR-20). Только в сборке: dev-сервер Vite использует inline-скрипты. */
export function csp(env: Env): string {
  const bases = (env.VITE_PROVIDER || 'animevost') === 'anyview' ? [env.VITE_API_BASE ?? ''] : parseBases(env.VITE_ANIMEVOST_BASES);
  const connect = [...new Set(bases.filter(Boolean).map((b) => new URL(b).origin))];
  return [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data:",
    "media-src https: blob:",
    "font-src 'self'",
    `connect-src 'self' ${connect.join(' ')}`.trim(),
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

