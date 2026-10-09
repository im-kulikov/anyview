/** http:// → https:// (иначе GitHub Pages блокирует смешанный контент). */
export const https = (url: string): string => url.replace(/^http:\/\//i, 'https://');
