/**
 * OpenDesign — manifest core (shared by the builder and the validator).
 *
 * Zero dependencies on purpose: only `node:*` built-ins, so anyone can run
 * `npm run build` on a fresh clone with no install step and no paid service.
 *
 * @license MIT
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Sections scanned into the manifest, in sidebar order. */
export const SECTIONS = [
  {
    id: 'mockups',
    label: 'Mockups',
    dir: 'mockups',
    icon: 'layers',
    hint: 'Interactive prototypes. Drop an HTML file in its own folder.',
  },
  {
    id: 'design-systems',
    label: 'Design Systems',
    dir: 'design-systems',
    icon: 'palette',
    hint: 'Tokens, themes and documentation shared across mockups.',
  },
];

/** File kinds the viewer knows how to render (anything else is offered as a download). */
export const KINDS = {
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.svg': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.gif': 'image',
  '.avif': 'image',
  '.pdf': 'document',
};

export const MANIFEST_VERSION = 2;

/** `restaurant-automation` -> `Restaurant automation` */
export function humanize(slug) {
  return String(slug)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Pull the first `<title>` out of an HTML document without a parser dependency. */
export function readTitle(source, fallback = '') {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  if (!match) return fallback;
  return match[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

/** Pull the first `<h1>` out of a Markdown document. */
export function readMarkdownTitle(source, fallback = '') {
  for (const line of source.split('\n')) {
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  return fallback;
}

/** Pull the `"name"` field out of a JSON token file. */
export function readJsonName(source, fallback = '') {
  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim()) return parsed.name.trim();
  } catch {
    /* not valid JSON — the validator reports it separately */
  }
  return fallback;
}

async function listFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      out.push(...(await listFiles(full)));
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.')) continue;
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan the repo and build the manifest object.
 * @param {string} root absolute path to the repository root
 * @returns {Promise<object>} manifest (without the volatile `generated` field)
 */
export async function buildManifest(root) {
  const sections = [];
  let total = 0;

  for (const section of SECTIONS) {
    const baseDir = path.join(root, section.dir);
    const files = await listFiles(baseDir);
    const groups = new Map();

    for (const abs of files) {
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const parts = rel.split('/');
      // <sectionDir>/<group>/...<file>  — files directly under the section dir form a "(root)" group.
      const slug = parts.length > 2 ? parts[1] : '(root)';
      const info = await stat(abs);
      const ext = path.extname(abs).toLowerCase();
      const kind = KINDS[ext] || 'binary';
      const entry = {
        label: parts[parts.length - 1],
        path: rel,
        kind,
        bytes: info.size,
      };

      // Only text-ish formats are worth titling; keep the scan cheap and offline.
      if (kind === 'html' || kind === 'markdown' || kind === 'json') {
        const source = await readFile(abs, 'utf8');
        const fallback = humanize(slug === '(root)' ? entry.label : slug);
        if (kind === 'html') entry.title = readTitle(source, fallback);
        else if (kind === 'markdown') entry.title = readMarkdownTitle(source, fallback);
        else entry.title = readJsonName(source, fallback);
      }

      if (!groups.has(slug)) {
        groups.set(slug, {
          slug,
          label: slug === '(root)' ? section.label : humanize(slug),
          files: [],
        });
      }
      groups.get(slug).files.push(entry);
      total += 1;
    }

    sections.push({
      id: section.id,
      label: section.label,
      icon: section.icon,
      hint: section.hint,
      groups: [...groups.values()],
    });
  }

  return {
    version: MANIFEST_VERSION,
    name: 'OpenDesign',
    license: 'MIT',
    counts: {
      files: total,
      mockups: countFiles(sections, 'mockups'),
      designSystems: countFiles(sections, 'design-systems'),
    },
    sections,
  };
}

function countFiles(sections, id) {
  const section = sections.find((s) => s.id === id);
  if (!section) return 0;
  return section.groups.reduce((n, g) => n + g.files.length, 0);
}

/**
 * Compare two manifests ignoring volatile fields (`generated`).
 * @returns {boolean} true when the checked-in manifest matches a fresh scan
 */
export function manifestsMatch(a, b) {
  const strip = (m) => JSON.stringify({ ...m, generated: undefined });
  return strip(a) === strip(b);
}
