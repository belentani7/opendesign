/**
 * Offline-safety checks.
 *
 * "Offline-safe" means a document never asks the network for a *resource*.
 * Plain hyperlinks (`<a href>`), `rel="canonical"` and `<meta property="og:*">`
 * are metadata: they cost nothing, work with no connection, and are allowed.
 *
 * @license MIT
 */

export const RESOURCE_PATTERNS = [
  [/<script[^>]+src=["'](?:https?:)?\/\/[^"']+/gi, '<script src>'],
  [/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](?:https?:)?\/\/[^"']+/gi, '<link rel=stylesheet>'],
  [/<link[^>]+href=["'](?:https?:)?\/\/[^"']+["'][^>]*rel=["']stylesheet["']/gi, '<link rel=stylesheet>'],
  [
    /<link[^>]+rel=["'](?:icon|shortcut icon|preload|modulepreload|prefetch|preconnect|dns-prefetch)["'][^>]+href=["'](?:https?:)?\/\/[^"']+/gi,
    '<link rel=icon/preload>',
  ],
  [/<(?:img|iframe|source|video|audio|embed|object)[^>]+src=["'](?:https?:)?\/\/[^"']+/gi, '<media src>'],
  [/@import\s+(?:url\()?["']?(?:https?:)?\/\//gi, 'css @import'],
  [/url\(\s*["']?(?:https?:)?\/\/[^)]+\)/gi, 'css url()'],
  // Bounded by </style>, otherwise the lazy match can run past the block and
  // "find" a URL that lives in a later <script> tag.
  [/<style[^>]*>(?:(?!<\/style>)[\s\S])*?https?:\/\//gi, 'remote reference inside <style>'],
];

/**
 * @param {string} html
 * @returns {string[]} one entry per remote resource load found
 */
export function findRemoteResources(html) {
  const found = [];
  for (const [re, label] of RESOURCE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of String(html).matchAll(re)) {
      found.push(`${label}: ${m[0].slice(0, 120)}`);
    }
  }
  return found;
}
