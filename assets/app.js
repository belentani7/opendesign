/*
 * OpenDesign Studio — viewer logic
 *
 * Vanilla ES modules, no dependencies, no network requests. The manifest is
 * fetched over HTTP and falls back to `manifest.js` when the page is opened
 * from disk (`file://`), where fetch() of a local file is blocked.
 *
 * Every pure helper is exported so `npm test` can exercise the real code
 * paths in Node instead of a re-implementation.
 *
 * @license MIT
 */

/* ═══════════════════ pure helpers (tested in Node) ═══════════════════ */

/** Devices offered by the stage. `fill` is fluid; the rest are fixed viewports. */
export const DEVICES = [
  { id: 'fill', label: 'Fill', w: 0, h: 0, shape: 'none' },
  { id: 'desktop', label: 'Desktop', w: 1440, h: 900, shape: 'none' },
  { id: 'laptop', label: 'Laptop', w: 1280, h: 800, shape: 'none' },
  { id: 'tablet', label: 'Tablet', w: 834, h: 1112, shape: 'tablet' },
  { id: 'mobile', label: 'Mobile', w: 390, h: 844, shape: 'phone' },
];

export const KIND_LABEL = {
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  markdown: 'MD',
  text: 'TXT',
  image: 'IMG',
  document: 'DOC',
  binary: 'BIN',
};

/** Escapes the five characters that matter when injecting text into HTML. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** `17757` -> `17.3 KB` */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i += 1;
  } while (v >= 1024 && i < units.length - 1);
  // Whole numbers and anything ≥10 read better without a decimal (3 MB, 17 KB).
  const rounded = v >= 10 || Number.isInteger(v) ? Math.round(v) : Number(v.toFixed(1));
  return `${rounded} ${units[i]}`;
}

/** `#/mockups/x/index.html?device=mobile` -> `{ path, device, zoom }` */
export function parseHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return { path: '', device: '', zoom: '' };
  const [rawPath, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  let p = rawPath;
  try {
    p = decodeURIComponent(rawPath);
  } catch {
    /* malformed percent-encoding — use the raw value */
  }
  return {
    path: p.replace(/^\/+/, ''),
    device: params.get('device') || '',
    zoom: params.get('zoom') || '',
  };
}

/** Inverse of `parseHash`. Empty optionals are dropped to keep URLs short. */
export function buildHash({ path, device = '', zoom = '' }) {
  const parts = [];
  if (device && device !== 'fill') parts.push(`device=${encodeURIComponent(device)}`);
  if (zoom && String(zoom) !== '1') parts.push(`zoom=${encodeURIComponent(zoom)}`);
  const encoded = String(path)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `#/${encoded}${parts.length ? `?${parts.join('&')}` : ''}`;
}

/** Flatten a manifest into a searchable list, keeping group + section context. */
export function flattenFiles(manifest) {
  const out = [];
  for (const section of manifest?.sections ?? []) {
    for (const group of section.groups ?? []) {
      for (const file of group.files ?? []) {
        out.push({
          ...file,
          kind: file.kind || 'binary',
          group: group.slug,
          groupLabel: group.label,
          section: section.id,
          sectionLabel: section.label,
        });
      }
    }
  }
  return out;
}

/**
 * Subsequence match with a simple relevance score (0 = no match, higher = better).
 * Consecutive hits and early hits score higher; matching on the label or the
 * document title beats matching inside the path.
 */
export function fuzzyMatch(query, haystack) {
  const q = String(query || '').toLowerCase().trim();
  const h = String(haystack || '').toLowerCase();
  if (!q) return { score: 1, indices: [] };
  if (!h) return null;

  const exact = h.indexOf(q);
  if (exact !== -1) {
    return { score: 1000 - exact, indices: Array.from({ length: q.length }, (_, i) => exact + i) };
  }

  const indices = [];
  let hi = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    let found = -1;
    while (hi < h.length) {
      if (h[hi] === ch) {
        found = hi;
        hi += 1;
        break;
      }
      hi += 1;
    }
    if (found === -1) return null;
    streak = indices.length && indices[indices.length - 1] === found - 1 ? streak + 1 : 1;
    score += 10 + streak * 6 - Math.min(found, 60) * 0.05;
    if (found === 0 || /[\s\-_./]/.test(h[found - 1])) score += 12; // word boundary
    indices.push(found);
  }
  return { score, indices };
}

/**
 * Rank files for the palette: label first, then title, then path.
 * Always returns `{ file, score, indices }` wrappers — with or without a query.
 */
export function searchFiles(files, query) {
  const q = String(query || '').trim();
  if (!q) return files.slice(0, 40).map((file) => ({ file, score: 0, indices: [] }));
  const scored = [];
  for (const file of files) {
    const a = fuzzyMatch(q, file.label);
    const b = fuzzyMatch(q, file.title || '');
    const c = fuzzyMatch(q, `${file.group} ${file.section}`);
    const d = fuzzyMatch(q, file.path);
    const best = [a && a.score * 1.2, b && b.score * 1.0, c && c.score * 0.8, d && d.score * 0.6]
      .filter((n) => typeof n === 'number')
      .sort((x, y) => y - x)[0];
    if (best == null) continue;
    scored.push({ file, score: best, indices: a && a.score >= best / 1.2 ? a.indices : [] });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, 40);
}

/** `mockups/historia-que-recuerda/index.html` -> `[section, group, file]` */
export function pathSegments(p) {
  return String(p || '').split('/').filter(Boolean);
}

/* ── token parsing, for the CSS/JSON specimen renderer ─────────────── */

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|var\(--[^)]*\)|[a-z]+)$/i;
const SIZE_NAME_RE = /font|size|space|spacing|margin|padding|gap|width|height|radius|leading|tracking/i;

/**
 * Pull design tokens out of a stylesheet.
 * @returns {{colors: Array, sizes: Array, others: Array}}
 */
export function parseCssTokens(css) {
  const colors = [];
  const sizes = [];
  const others = [];
  for (const m of String(css).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
    const name = m[1];
    const value = m[2].trim();
    const token = { name, value };
    const looksColorish = /color|bg|text|surface|border|accent|status|gold|gray|black|white|red|green|blue|amber|purple/i.test(name);
    const singleValue = !/\s/.test(value);
    if (looksColorish && COLOR_RE.test(value)) colors.push(token);
    else if (singleValue && SIZE_NAME_RE.test(name) && /\d/.test(value)) sizes.push(token);
    else others.push(token);
  }
  return { colors, sizes, others };
}

/**
 * Walk a DTCG-style token file (`{ value, type }`) into flat token records.
 * @returns {Array<{name: string, value: string, type: string}>}
 */
export function flattenTokens(node, prefix = '', out = []) {
  if (!node || typeof node !== 'object') return out;
  if ('$value' in node || 'value' in node) {
    out.push({
      name: prefix,
      value: String(node.$value ?? node.value),
      type: String(node.$type ?? node.type ?? ''),
    });
    return out;
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    flattenTokens(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

/**
 * Blocks `javascript:`/`data:`-style URLs from reaching an `href` or `src`.
 * Relative and fragment URLs are allowed through untouched.
 */
export function safeUrl(url) {
  const value = String(url ?? '').trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme) return value; // relative, absolute path or fragment
  return ['http', 'https', 'mailto', 'tel'].includes(scheme[1].toLowerCase()) ? value : '#';
}

/* ── minimal Markdown renderer (no dependencies) ───────────────────── */

/** Renders the subset of Markdown used by repo docs. Not a CommonMark engine. */
export function renderMarkdown(src) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol'
  let code = null; // {lang, body[]}
  let table = null;

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushTable = () => {
    if (table) {
      const [head, ...rows] = table;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
          '</tbody></table>',
      );
      table = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  function inline(text) {
    let s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img alt="${alt}" src="${safeUrl(src)}">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${safeUrl(href)}">${text}</a>`);
    s = s.replace(/(^|[\s(])\*{2}([^*]+)\*{2}/g, '$1<strong>$2</strong>');
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) {
        out.push(`<pre><code class="lang-${escapeHtml(code.lang)}">${escapeHtml(code.body.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.body.push(line);
      }
      continue;
    }
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line);
    if (fence) {
      flushAll();
      code = { lang: fence[1] || '', body: [] };
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushAll();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length, 4);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\s*([-*_])\s*\1\s*\1[\s-*_]*$/.test(line)) {
      flushAll();
      out.push('<hr>');
      continue;
    }
    const row = /^\s*\|(.+)\|\s*$/.exec(line);
    if (row) {
      const cells = row[1].split('|').map((c) => c.trim());
      if (/^[-:\s|]+$/.test(row[1])) continue; // separator row
      if (!table) {
        flushPara();
        flushList();
        table = [cells];
      } else {
        table.push(cells);
      }
      continue;
    }
    flushTable();
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      if (list !== 'ul') {
        flushList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushPara();
      if (list !== 'ol') {
        flushList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushAll();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  if (code) out.push(`<pre><code>${escapeHtml(code.body.join('\n'))}</code></pre>`);
  flushAll();
  return out.join('\n');
}

/* ── tiny syntax highlighter ───────────────────────────────────────── */

const HL_RULES = {
  json: [
    ['com', /\/\*[\s\S]*?\*\//],
    ['key', /&quot;(?:[^&]|&(?!quot;))*?&quot;(?=\s*:)/],
    ['str', /&quot;(?:[^&]|&(?!quot;))*?&quot;/],
    ['num', /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/],
    ['key', /\b(?:true|false|null)\b/],
  ],
  css: [
    ['com', /\/\*[\s\S]*?\*\//],
    ['str', /&quot;(?:[^&]|&(?!quot;))*?&quot;/],
    ['sel', /(?:^|\n)\s*[.:#\[][^\n{}]*\{/],
    ['key', /(?:^|[{;\s])(--[\w-]+|[a-z-]+)(?=\s*:)/],
    ['num', /#[0-9a-fA-F]{3,8}\b|\b-?\d*\.?\d+(?:px|rem|em|%|s|ms|vh|vw|deg)?\b/],
  ],
  html: [
    ['com', /&lt;!--[\s\S]*?--&gt;/],
    ['str', /&quot;[^&]*?&quot;/],
    ['tag', /&lt;\/?[a-zA-Z][\w-]*|\/?&gt;/],
    ['key', /\s[a-zA-Z-]+(?==)/],
  ],
  js: [
    ['com', /\/\*[\s\S]*?\*\/|\/\/[^\n]*/],
    ['str', /&quot;(?:[^&]|&(?!quot;))*?&quot;|&#39;(?:[^&]|&(?!#39;))*?&#39;|`[^`]*`/],
    ['key', /\b(?:const|let|var|function|return|if|else|for|while|await|async|import|export|from|class|new|typeof|of|in|null|true|false|undefined|this)\b/],
    ['num', /\b\d+(?:\.\d+)?\b/],
  ],
  markdown: [['key', /^#{1,6}\s.*/]],
  text: [],
};

/** Escape + colourise source code. Never injects the input as markup. */
export function highlight(source, lang) {
  const escaped = escapeHtml(source);
  const rules = HL_RULES[lang] || HL_RULES.text;
  if (!rules.length) return escaped;
  // One combined pass with a named group per rule, so the winning rule is known
  // from the match itself. (Re-testing each rule against the matched text breaks
  // for rules that end in a look-ahead, e.g. JSON keys.)
  const combined = new RegExp(rules.map(([, re], i) => `(?<g${i}>${re.source})`).join('|'), 'gm');
  return escaped.replace(combined, (...args) => {
    const groups = args[args.length - 1];
    for (let i = 0; i < rules.length; i += 1) {
      const hit = groups[`g${i}`];
      if (hit !== undefined) return `<span class="tk-${rules[i][0]}">${hit}</span>`;
    }
    return args[0];
  });
}

/** Number the lines of a highlighted source string. */
export function withLineNumbers(highlighted) {
  return highlighted
    .split('\n')
    .map((line) => `<span class="ln">${line || ' '}</span>`)
    .join('');
}

/* ═══════════════════════ browser app ═══════════════════════ */

const STORAGE = { theme: 'od.theme', device: 'od.device', zoom: 'od.zoom' };

export function createApp(doc = globalThis.document, win = globalThis.window) {
  const $ = (sel) => doc.querySelector(sel);

  const el = {
    html: doc.documentElement,
    tree: $('#tree'),
    filter: $('#filter'),
    filterWrap: $('#filter-wrap'),
    filterClear: $('#filter-clear'),
    preview: $('#preview'),
    device: $('#device'),
    placeholder: $('#placeholder'),
    placeholderBody: $('#placeholder-body'),
    crumbs: $('#crumbs-list'),
    statusPath: $('#status-path'),
    statusMeta: $('#status-meta'),
    statusView: $('#status-view'),
    zoom: $('#zoom-range'),
    zoomRead: $('#zoom-read'),
    zoomOut: $('#zoom-out'),
    zoomIn: $('#zoom-in'),
    reload: $('#reload'),
    source: $('#source-toggle'),
    present: $('#present-toggle'),
    open: $('#open-new'),
    copy: $('#copy-link'),
    drawer: $('#drawer'),
    drawerBody: $('#drawer-body'),
    drawerPath: $('#drawer-path'),
    drawerClose: $('#drawer-close'),
    drawerCopy: $('#drawer-copy'),
    palette: $('#palette'),
    paletteQ: $('#palette-q'),
    paletteList: $('#palette-list'),
    searchTrigger: $('#search-trigger'),
    help: $('#help'),
    helpOpen: $('#help-open'),
    helpClose: $('#help-close'),
    themeToggle: $('#theme-toggle'),
    navToggle: $('#nav-toggle'),
    sidebar: $('#sidebar'),
    scrim: $('#scrim'),
    live: $('#live'),
    toast: $('#toast'),
    deviceGroup: $('#devices'),
  };

  const state = {
    manifest: null,
    files: [],
    current: null,
    device: 'fill',
    zoom: 1,
    theme: 'system',
    paletteIndex: 0,
    paletteResults: [],
    sourceOpen: false,
    presentation: false,
  };

  /* ── small utilities ─────────────────────────────────────────── */

  const announce = (msg) => {
    if (el.live) el.live.textContent = msg;
  };

  let toastTimer;
  const toast = (msg) => {
    if (!el.toast) return;
    el.toast.querySelector('[data-toast-text]').textContent = msg;
    el.toast.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.dataset.show = 'false';
    }, 1900);
  };

  const store = {
    get(key, fallback) {
      try {
        const v = win.localStorage.getItem(key);
        return v == null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        win.localStorage.setItem(key, String(value));
      } catch {
        /* private mode — preferences simply do not persist */
      }
    },
  };

  /* ── theme ───────────────────────────────────────────────────── */

  function applyTheme() {
    const prefersLight = win.matchMedia?.('(prefers-color-scheme: light)').matches;
    const resolved = state.theme === 'system' ? (prefersLight ? 'light' : 'dark') : state.theme;
    el.html.dataset.theme = resolved;
    el.html.dataset.themeMode = state.theme;
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'light' ? '#eceef2' : '#07080a');
    if (el.themeToggle) {
      el.themeToggle.setAttribute(
        'aria-label',
        `Theme: ${state.theme} (currently ${resolved}). Activate to change.`,
      );
      el.themeToggle.dataset.mode = state.theme;
    }
  }

  function cycleTheme() {
    const order = ['system', 'dark', 'light'];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    store.set(STORAGE.theme, state.theme);
    applyTheme();
    toast(`Theme: ${state.theme}`);
  }

  /* ── manifest loading ────────────────────────────────────────── */

  async function loadManifest() {
    try {
      const res = await win.fetch('./manifest.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.sections) return data;
      throw new Error('manifest.json has no "sections"');
    } catch (fetchError) {
      // `file://` or a broken fetch — the generated manifest.js is the fallback.
      if (win.OpenDesignManifest?.sections) return win.OpenDesignManifest;
      throw fetchError;
    }
  }

  /* ── sidebar ─────────────────────────────────────────────────── */

  function iconFor(kind) {
    return `<span class="file-icon" data-kind="${escapeHtml(kind)}">${KIND_LABEL[kind] || 'FILE'}</span>`;
  }

  function renderTree(filterText = '') {
    const q = filterText.trim();
    let html = '';
    let visible = 0;

    for (const section of state.manifest.sections) {
      const groups = (section.groups || [])
        .map((group) => {
          const files = (group.files || []).filter((file) => {
            if (!q) return true;
            return (
              fuzzyMatch(q, file.label) ||
              fuzzyMatch(q, file.title || '') ||
              fuzzyMatch(q, `${group.slug} ${section.id}`) ||
              fuzzyMatch(q, file.path)
            );
          });
          return files.length ? { ...group, files } : null;
        })
        .filter(Boolean);

      if (!groups.length) continue;
      const count = groups.reduce((n, g) => n + g.files.length, 0);
      visible += count;

      html += `<section class="section" aria-labelledby="sec-${section.id}">
        <h2 class="section-head" id="sec-${section.id}">
          <svg aria-hidden="true"><use href="#i-${section.icon}"/></svg>
          ${escapeHtml(section.label)}
          <span class="count-pill">${count}</span>
        </h2>`;

      for (const group of groups) {
        const open = q ? ' open' : (group.files.length > 6 ? '' : ' open');
        html += `<details class="group"${open}>
          <summary>
            <svg class="chev" aria-hidden="true"><use href="#i-chevron"/></svg>
            <span class="group-label">${escapeHtml(group.label)}</span>
            <span class="count-pill">${group.files.length}</span>
          </summary>
          <div class="files" role="list">`;
        for (const file of group.files) {
          const active = state.current?.path === file.path;
          // Roving tabindex: exactly one row is tabbable at a time.
          const tabbable = active || (!state.current && !q);
          const title = file.title && file.title !== file.label ? `<span class="file-title">${escapeHtml(file.title)}</span>` : '';
          html += `<button type="button" class="file" role="listitem" data-path="${escapeHtml(file.path)}"
              aria-current="${active}" tabindex="${tabbable ? '0' : '-1'}">
              ${iconFor(file.kind)}
              <span class="file-main">
                <span class="file-name">${escapeHtml(file.label)}</span>
                ${title}
              </span>
              <span class="file-size">${formatBytes(file.bytes)}</span>
            </button>`;
        }
        html += `</div></details>`;
      }
      html += `</section>`;
    }

    el.tree.innerHTML = html || emptyTreeMessage(q);
    const rows = [...el.tree.querySelectorAll('.file')];
    rows.forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.path));
    });
    // If filtering hides the selected row, still leave one row reachable by Tab.
    if (rows.length && !rows.some((r) => r.getAttribute('tabindex') === '0')) {
      rows[0].setAttribute('tabindex', '0');
    }
    if (visible === 0 && q) announce(`No artifacts match ${q}`);
    return visible;
  }

  function emptyTreeMessage(q) {
    if (q) {
      return `<p class="tree-msg">Nothing matches <code>${escapeHtml(q)}</code>.</p>`;
    }
    return `<p class="tree-msg">No artifacts indexed yet.<br><br>
      Add an HTML file under <code>mockups/&lt;name&gt;/</code> or tokens under
      <code>design-systems/&lt;name&gt;/</code>, then run <code>npm run build</code>.<br><br>
      See <a href="https://github.com/belentani7/opendesign/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a>.</p>`;
  }

  /** Move focus + selection through the visible file buttons with the arrows. */
  function moveFocus(delta) {
    const items = [...el.tree.querySelectorAll('.file')];
    if (!items.length) return;
    const idx = items.findIndex((n) => n === doc.activeElement);
    const next = items[Math.min(items.length - 1, Math.max(0, idx + delta))] || items[0];
    items.forEach((n) => n.setAttribute('tabindex', '-1'));
    next.setAttribute('tabindex', '0');
    next.focus();
  }

  /* ── routing ─────────────────────────────────────────────────── */

  function navigate(path, { push = true, device, zoom } = {}) {
    const file = state.files.find((f) => f.path === path);
    if (!file) {
      showError(`No artifact at that path`, path);
      return;
    }
    state.current = file;
    if (device) setDevice(device, { silent: true });
    if (zoom) setZoom(Number(zoom), { silent: true });

    if (push) {
      const hash = buildHash({ path, device: state.device, zoom: state.zoom });
      if (win.location.hash !== hash) win.history.pushState(null, '', hash);
    }
    el.open.href = file.path;
    syncSidebarActive();
    renderCrumbs(file);
    renderStatus(file);
    void renderPreview(file);
    closeDrawer();
    announce(`Previewing ${file.label}`);
    if (win.innerWidth <= 900) setDrawer(false);
  }

  /** Keep the selected row and the roving tabindex in sync (one tabbable row). */
  function syncSidebarActive() {
    const rows = [...el.tree.querySelectorAll('.file')];
    rows.forEach((btn) => {
      const active = btn.dataset.path === state.current?.path;
      btn.setAttribute('aria-current', String(active));
      btn.setAttribute('tabindex', active ? '0' : '-1');
    });
    const active = rows.find((btn) => btn.getAttribute('aria-current') === 'true');
    if (active) {
      active.closest('details')?.setAttribute('open', '');
    } else if (rows.length) {
      rows[0].setAttribute('tabindex', '0');
    }
  }

  function renderCrumbs(file) {
    const parts = pathSegments(file.path);
    el.crumbs.innerHTML = parts
      .map((seg, i) => {
        const last = i === parts.length - 1;
        return `<li class="${last ? 'here' : ''}">${escapeHtml(seg)}</li>` +
          (last ? '' : '<li class="sep" aria-hidden="true">/</li>');
      })
      .join('');
  }

  function renderStatus(file) {
    el.statusPath.textContent = file.path;
    el.statusMeta.textContent = `${KIND_LABEL[file.kind] || file.kind} · ${formatBytes(file.bytes)}${
      file.title ? ` · ${file.title}` : ''
    }`;
    updateViewStatus();
  }

  function updateViewStatus() {
    const dev = DEVICES.find((d) => d.id === state.device);
    el.statusView.textContent =
      state.device === 'fill' ? 'fluid' : `${dev.w}×${dev.h} @ ${Math.round(state.zoom * 100)}%`;
  }

  function syncHashFromState() {
    if (!state.current) return;
    const hash = buildHash({ path: state.current.path, device: state.device, zoom: state.zoom });
    if (win.location.hash !== hash) win.history.replaceState(null, '', hash);
  }

  /* ── preview ─────────────────────────────────────────────────── */

  async function renderPreview(file) {
    el.placeholder.hidden = true;
    el.device.hidden = false;
    el.preview.removeAttribute('srcdoc');

    const direct = ['html', 'image', 'document'].includes(file.kind);
    if (direct) {
      el.preview.src = `${file.path}?v=${Date.now()}`;
      el.preview.title = `Preview of ${file.label}`;
      return;
    }

    let body;
    try {
      const res = await win.fetch(file.path, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      body = specimenFor(file, text);
    } catch (err) {
      showError(`Could not load ${file.label}`, `${file.path} — ${err.message}`);
      return;
    }
    el.preview.removeAttribute('src');
    el.preview.srcdoc = body;
    el.preview.title = `Rendered ${file.label}`;
  }

  function showError(title, detail) {
    el.device.hidden = true;
    el.placeholder.hidden = false;
    el.placeholderBody.innerHTML = `<div class="error-card">
        <h2>${escapeHtml(title)}</h2>
        <p>This artifact is listed in the manifest but could not be read.</p>
        <code>${escapeHtml(detail)}</code>
        <p>Serve the repo with <code>npm run dev</code>, or re-run <code>npm run build</code> to refresh the manifest.</p>
      </div>`;
    announce(title);
  }

  function specimenFor(file, text) {
    const dark = el.html.dataset.theme !== 'light';
    if (file.kind === 'css') return cssSpecimen(file, text, dark);
    if (file.kind === 'markdown') return markdownSpecimen(file, text, dark);
    if (file.kind === 'json') return jsonSpecimen(file, text, dark);
    return textSpecimen(file, text, dark);
  }

  const specimenBase = (dark) => `
    <style>
      :root { color-scheme: ${dark ? 'dark' : 'light'}; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: ${dark ? '#0b0d11' : '#fff'};
        color: ${dark ? '#eef1f6' : '#10131a'};
        font: 14px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .specimen { padding: 34px 38px 60px; max-width: 940px; }
      .specimen-head { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;
        padding-bottom:14px; border-bottom:1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}; }
      .specimen-head h1 { margin:0; font-size:21px; font-weight:650; letter-spacing:-.01em; }
      .specimen-head .kind { font-family:ui-monospace,monospace; font-size:10px; letter-spacing:.1em;
        text-transform:uppercase; padding:3px 8px; border-radius:99px;
        background:rgba(201,168,76,.16); color:#c9a84c; }
      .swatch-group { margin-top:26px; }
      .swatch-group h2 { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
        color:${dark ? 'rgba(255,255,255,.45)' : 'rgba(16,19,26,.5)'}; margin:0 0 10px; }
      .swatch-row { display:flex; flex-wrap:wrap; gap:10px; }
      .swatch { width:128px; border:1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'};
        border-radius:9px; overflow:hidden; background:${dark ? 'rgba(255,255,255,.03)' : '#fafafa'}; }
      .swatch .chip { height:46px; }
      .swatch .meta { padding:7px 9px; }
      .swatch .meta b { display:block; font-family:ui-monospace,monospace; font-size:9.5px; font-weight:500;
        color:${dark ? 'rgba(255,255,255,.8)' : '#10131a'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .swatch .meta i { font-style:normal; font-family:ui-monospace,monospace; font-size:9.5px;
        color:${dark ? 'rgba(255,255,255,.4)' : 'rgba(16,19,26,.5)'}; text-transform:uppercase; }
      .scale-row { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; }
      .scale-item { border-left:2px solid rgba(201,168,76,.45); padding-left:10px; }
      .scale-item small { display:block; font-family:ui-monospace,monospace; font-size:9.5px;
        color:${dark ? 'rgba(255,255,255,.4)' : 'rgba(16,19,26,.5)'}; margin-top:3px; }
      pre { margin:18px 0 0; padding:14px 16px; border-radius:10px; overflow-x:auto;
        background:${dark ? 'rgba(0,0,0,.35)' : '#f4f5f7'};
        color:${dark ? 'rgba(255,255,255,.75)' : '#232833'};
        font:11.5px/1.65 ui-monospace,monospace; }
      h1,h2,h3,h4 { letter-spacing:-.01em; }
      h1 { font-size:26px; } h2 { font-size:19px; margin-top:30px; } h3 { font-size:16px; margin-top:24px; }
      h4 { font-size:14px; margin-top:20px; }
      p, ul, ol, blockquote, table { font-size:14px; }
      a { color:#c9a84c; }
      code { font:12px ui-monospace,monospace; background:${dark ? 'rgba(255,255,255,.08)' : '#eef0f3'};
        padding:1px 5px; border-radius:4px; }
      pre code { background:none; padding:0; }
      blockquote { border-left:3px solid rgba(201,168,76,.5); margin:14px 0; padding:2px 0 2px 14px;
        color:${dark ? 'rgba(255,255,255,.6)' : '#4c5563'}; }
      table { border-collapse:collapse; margin-top:14px; }
      th,td { border:1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}; padding:7px 11px; text-align:left; }
      th { font-size:12px; text-transform:uppercase; letter-spacing:.05em; }
      hr { border:0; border-top:1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}; margin:26px 0; }
      img { max-width:100%; }
      .tk-key { color:#e3cb85; } .tk-str { color:#9ecb7a; } .tk-num { color:#d9a0e8; }
      .tk-com { color:#6c7583; font-style:italic; } .tk-tag { color:#7fb4e8; } .tk-sel { color:#e0a06b; }
    </style>`;

  const specimenShell = (file, kindLabel, inner, dark) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(file.title || file.label)}</title>
${specimenBase(dark)}</head><body>
<div class="specimen">
  <div class="specimen-head">
    <h1>${escapeHtml(file.title || file.label)}</h1>
    <span class="kind">${escapeHtml(kindLabel)}</span>
  </div>
  ${inner}
</div></body></html>`;

  function cssSpecimen(file, css, dark) {
    const { colors, sizes } = parseCssTokens(css);
    const inner = [];
    if (colors.length) {
      const groups = new Map();
      for (const c of colors) {
        const bucket = c.name.replace(/^--color-/, '').split('-')[0] || 'other';
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket).push(c);
      }
      for (const [bucket, items] of groups) {
        inner.push(`<div class="swatch-group"><h2>${escapeHtml(bucket)} · ${items.length}</h2><div class="swatch-row">`);
        for (const item of items) {
          inner.push(`<div class="swatch">
            <div class="chip" style="background:${escapeHtml(item.value)}"></div>
            <div class="meta"><b>${escapeHtml(item.name)}</b><i>${escapeHtml(item.value)}</i></div>
          </div>`);
        }
        inner.push('</div></div>');
      }
    }
    if (sizes.length) {
      inner.push(`<div class="swatch-group"><h2>scale · ${sizes.length}</h2><div class="scale-row">`);
      for (const item of sizes.slice(0, 26)) {
        const px = parseFloat(item.value);
        const size = Number.isFinite(px) && px <= 96 ? Math.max(9, px) : 14;
        inner.push(`<div class="scale-item"><span style="font-size:${size}px">Aa</span>
          <small>${escapeHtml(item.name)} · ${escapeHtml(item.value)}</small></div>`);
      }
      inner.push('</div></div>');
    }
    inner.push(`<div class="swatch-group"><h2>source</h2><pre>${highlight(css, 'css')}</pre></div>`);
    return specimenShell(file, `CSS · ${colors.length + sizes.length} tokens`, inner.join(''), dark);
  }

  function jsonSpecimen(file, text, dark) {
    let tokens = [];
    try {
      const parsed = JSON.parse(text);
      tokens = flattenTokens(parsed.tokens || parsed).filter((t) => t.value && t.value.length < 90);
    } catch {
      /* invalid JSON: still show the raw source below */
    }
    const inner = [];
    if (tokens.length) {
      const colors = tokens.filter((t) => t.type === 'color' || /^#|rgba?\(/.test(t.value));
      const others = tokens.filter((t) => !colors.includes(t));
      if (colors.length) {
        inner.push(`<div class="swatch-group"><h2>color · ${colors.length}</h2><div class="swatch-row">`);
        for (const c of colors) {
          inner.push(`<div class="swatch">
            <div class="chip" style="background:${escapeHtml(c.value)}"></div>
            <div class="meta"><b>${escapeHtml(c.name)}</b><i>${escapeHtml(c.value)}</i></div></div>`);
        }
        inner.push('</div></div>');
      }
      if (others.length) {
        inner.push(`<div class="swatch-group"><h2>other tokens · ${others.length}</h2>
          <pre>${highlight(others.map((t) => `${t.name}: ${t.value}`).join('\n'), 'css')}</pre></div>`);
      }
    }
    inner.push(`<div class="swatch-group"><h2>source</h2><pre>${highlight(text, 'json')}</pre></div>`);
    return specimenShell(file, `JSON · ${tokens.length} tokens`, inner.join(''), dark);
  }

  function markdownSpecimen(file, md, dark) {
    return specimenShell(file, 'Markdown', renderMarkdown(md), dark);
  }

  function textSpecimen(file, text, dark) {
    const lang = file.kind === 'text' ? 'text' : file.kind;
    return specimenShell(file, KIND_LABEL[file.kind] || file.kind, `<pre>${highlight(text, lang)}</pre>`, dark);
  }

  /* ── device + zoom ───────────────────────────────────────────── */

  function setDevice(id, { silent = false } = {}) {
    const dev = DEVICES.find((d) => d.id === id) || DEVICES[0];
    state.device = dev.id;
    el.device.dataset.mode = dev.id === 'fill' ? 'fill' : 'fixed';
    el.device.dataset.shape = dev.shape;
    el.device.style.setProperty('--dev-w', `${dev.w}px`);
    el.device.style.setProperty('--dev-h', `${dev.h}px`);
    if (dev.id === 'fill') setZoom(1, { silent: true });
    el.deviceGroup.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.device === dev.id));
    });
    store.set(STORAGE.device, dev.id);
    updateViewStatus();
    syncHashFromState();
    if (!silent) announce(`Viewport: ${dev.label}`);
  }

  function cycleDevice() {
    const i = DEVICES.findIndex((d) => d.id === state.device);
    setDevice(DEVICES[(i + 1) % DEVICES.length].id);
  }

  function setZoom(z, { silent = false } = {}) {
    state.zoom = Math.min(2, Math.max(0.2, Math.round(z * 100) / 100));
    el.device.style.setProperty('--zoom', String(state.zoom));
    el.zoom.value = String(state.zoom);
    el.zoomRead.textContent = `${Math.round(state.zoom * 100)}%`;
    updateViewStatus();
    syncHashFromState();
    if (!silent) store.set(STORAGE.zoom, state.zoom);
  }

  function fitZoom() {
    const dev = DEVICES.find((d) => d.id === state.device);
    if (!dev || state.device === 'fill') return setZoom(1);
    const rect = el.device.parentElement.getBoundingClientRect();
    const pad = 44;
    const z = Math.min((rect.width - pad) / dev.w, (rect.height - pad) / dev.h);
    setZoom(Math.min(1, Math.max(0.2, z)));
  }

  /* ── presentation mode ───────────────────────────────────────── */

  function setPresentation(on) {
    state.presentation = !!on;
    doc.body.dataset.presentation = String(state.presentation);
    el.present?.setAttribute('aria-pressed', String(state.presentation));
    if (state.presentation) fitZoom();
    toast(state.presentation ? 'Presentation mode — press P or Esc to exit' : 'Back to the studio');
    announce(state.presentation ? 'Presentation mode on' : 'Presentation mode off');
  }

  /* ── source drawer ───────────────────────────────────────────── */

  async function toggleSource(force) {
    const open = force ?? !state.sourceOpen;
    if (open && !state.current) return;
    state.sourceOpen = open;
    el.drawer.dataset.open = String(open);
    el.source.setAttribute('aria-pressed', String(open));
    el.drawer.setAttribute('aria-hidden', String(!open));
    if (!open) return;

    const file = state.current;
    el.drawerPath.textContent = file.path;
    el.drawerBody.innerHTML = '<pre><span class="ln">Loading…</span></pre>';
    if (!['html', 'css', 'json', 'markdown', 'text'].includes(file.kind)) {
      el.drawerBody.innerHTML = `<pre><span class="ln">Binary artifact — open it in a new tab to download.</span></pre>`;
      return;
    }
    try {
      const res = await win.fetch(file.path, { cache: 'no-store' });
      const text = await res.text();
      const lang = file.kind === 'markdown' ? 'markdown' : file.kind;
      el.drawerBody.innerHTML = `<pre>${withLineNumbers(highlight(text, lang))}</pre>`;
    } catch (err) {
      el.drawerBody.innerHTML = `<pre><span class="ln">Could not read source: ${escapeHtml(err.message)}</span></pre>`;
    }
  }

  const closeDrawer = () => state.sourceOpen && toggleSource(false);

  async function copySource() {
    if (!state.current) return;
    const text = el.drawerBody.textContent || '';
    await copyText(text);
  }

  /* ── clipboard + sharing ─────────────────────────────────────── */

  async function copyText(text) {
    try {
      await win.navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = doc.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  async function copyLink() {
    if (!state.current) return;
    const url = `${win.location.origin}${win.location.pathname}${buildHash({
      path: state.current.path,
      device: state.device,
      zoom: state.zoom,
    })}`;
    const ok = await copyText(url);
    toast(ok ? 'Shareable link copied' : 'Copy failed — link is in the address bar');
  }

  /* ── command palette ─────────────────────────────────────────── */

  function openPalette() {
    el.palette.hidden = false;
    el.paletteQ.value = '';
    renderPalette('');
    el.paletteQ.focus();
    el.paletteQ.select();
  }

  function closePalette() {
    el.palette.hidden = true;
    el.paletteQ.value = '';
  }

  function renderPalette(query) {
    const results = searchFiles(state.files, query);
    state.paletteResults = results.map((r) => r.file);
    state.paletteIndex = 0;
    if (!results.length) {
      el.paletteList.innerHTML = `<p class="palette-empty">No artifact matches “${escapeHtml(query)}”.</p>`;
      return;
    }
    el.paletteList.innerHTML = results
      .map(({ file }, i) => {
        const name = query ? markMatch(file.label, query) : escapeHtml(file.label);
        return `<button type="button" class="palette-item" data-path="${escapeHtml(file.path)}" data-index="${i}"
            data-active="${i === 0}" role="option" aria-selected="${i === 0}">
          ${iconFor(file.kind)}
          <span class="pi-main">
            <span class="pi-name">${name}</span>
            <span class="pi-path">${escapeHtml(file.path)}</span>
          </span>
        </button>`;
      })
      .join('');
    el.paletteList.querySelectorAll('.palette-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigate(btn.dataset.path);
        closePalette();
      });
      btn.addEventListener('pointermove', () => setActivePalette(Number(btn.dataset.index)));
    });
  }

  function markMatch(label, query) {
    const m = fuzzyMatch(query, label);
    const text = escapeHtml(label);
    if (!m || !m.indices.length) return text;
    // Walk the original string; the escaped string only differs at special chars,
    // which cannot appear in a match because the query is alphanumeric-ish.
    let out = '';
    let offset = 0;
    for (let i = 0; i < label.length; i += 1) {
      const piece = escapeHtml(label[i]);
      if (m.indices.includes(i)) out += `<mark>${piece}</mark>`;
      else out += piece;
      offset += 1;
    }
    return offset ? out : text;
  }

  function setActivePalette(i) {
    state.paletteIndex = Math.max(0, Math.min(state.paletteResults.length - 1, i));
    el.paletteList.querySelectorAll('.palette-item').forEach((btn) => {
      const active = Number(btn.dataset.index) === state.paletteIndex;
      btn.dataset.active = String(active);
      btn.setAttribute('aria-selected', String(active));
      if (active) btn.scrollIntoView({ block: 'nearest' });
    });
  }

  function choosePalette() {
    const file = state.paletteResults[state.paletteIndex];
    if (!file) return;
    navigate(file.path);
    closePalette();
  }

  /* ── mobile drawer ───────────────────────────────────────────── */

  function setDrawer(open) {
    el.sidebar.dataset.open = String(open);
    doc.body.dataset.drawer = open ? 'open' : 'closed';
    el.navToggle?.setAttribute('aria-expanded', String(open));
  }

  /* ── events ──────────────────────────────────────────────────── */

  function bindEvents() {
    el.filter.addEventListener('input', () => {
      el.filterWrap.dataset.dirty = String(el.filter.value.length > 0);
      renderTree(el.filter.value);
    });
    el.filterClear.addEventListener('click', () => {
      el.filter.value = '';
      el.filterWrap.dataset.dirty = 'false';
      renderTree('');
      el.filter.focus();
    });

    el.tree.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveFocus(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveFocus(-1);
      }
    });

    el.deviceGroup.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => setDevice(btn.dataset.device));
    });

    el.zoom.addEventListener('input', () => setZoom(Number(el.zoom.value)));
    el.zoomOut.addEventListener('click', () => setZoom(state.zoom - 0.1));
    el.zoomIn.addEventListener('click', () => setZoom(state.zoom + 0.1));
    el.reload.addEventListener('click', async () => {
      el.reload.classList.add('spin');
      if (state.current) await renderPreview(state.current);
      setTimeout(() => el.reload.classList.remove('spin'), 500);
      toast('Preview reloaded');
    });
    el.source.addEventListener('click', () => toggleSource());
    el.present?.addEventListener('click', () => setPresentation(!state.presentation));
    el.drawerClose.addEventListener('click', () => toggleSource(false));
    el.drawerCopy.addEventListener('click', copySource);
    el.copy.addEventListener('click', copyLink);
    el.searchTrigger.addEventListener('click', openPalette);
    el.paletteQ.addEventListener('input', () => renderPalette(el.paletteQ.value));
    el.palette.addEventListener('click', (e) => {
      if (e.target === el.palette) closePalette();
    });
    el.helpOpen.addEventListener('click', () => {
      el.help.hidden = false;
    });
    el.help.addEventListener('click', (e) => {
      if (e.target === el.help) el.help.hidden = true;
    });
    el.helpClose.addEventListener('click', () => {
      el.help.hidden = true;
    });
    el.themeToggle.addEventListener('click', cycleTheme);
    el.navToggle?.addEventListener('click', () => setDrawer(el.sidebar.dataset.open !== 'true'));
    el.scrim.addEventListener('click', () => setDrawer(false));

    win.addEventListener('hashchange', () => {
      const { path, device, zoom } = parseHash(win.location.hash);
      if (path && path !== state.current?.path) navigate(path, { push: false, device, zoom });
    });
    win.addEventListener('popstate', () => {
      const { path } = parseHash(win.location.hash);
      if (!path) return;
      if (path !== state.current?.path) navigate(path, { push: false });
    });
    win.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
      if (state.theme === 'system') {
        applyTheme();
        if (state.current) void renderPreview(state.current);
      }
    });
    win.addEventListener('resize', () => {
      if (win.innerWidth > 900) setDrawer(false);
    });

    doc.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(doc.activeElement?.tagName || '');
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el.palette.hidden ? openPalette() : closePalette();
        return;
      }
      if (e.key === 'Escape') {
        if (!el.palette.hidden) return closePalette();
        if (state.presentation) return setPresentation(false);
        if (!el.help.hidden) {
          el.help.hidden = true;
          return;
        }
        if (state.sourceOpen) return toggleSource(false);
        if (el.sidebar.dataset.open === 'true') return setDrawer(false);
        if (typing) return doc.activeElement.blur();
        return;
      }
      if (!el.palette.hidden) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActivePalette(state.paletteIndex + 1);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActivePalette(state.paletteIndex - 1);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          choosePalette();
        }
        return;
      }
      if (typing || mod) return;

      const keys = {
        '/': () => el.filter.focus(),
        '?': () => {
          el.help.hidden = false;
        },
        d: cycleDevice,
        f: fitZoom,
        s: () => toggleSource(),
        o: () => state.current && win.open(state.current.path, '_blank', 'noopener,noreferrer'),
        c: copyLink,
        r: () => el.reload.click(),
        t: cycleTheme,
        p: () => setPresentation(!state.presentation),
        '[': () => setZoom(state.zoom - 0.1),
        ']': () => setZoom(state.zoom + 0.1),
        '0': () => setZoom(1),
      };
      const action = keys[e.key] || keys[e.key?.toLowerCase()];
      if (action) {
        e.preventDefault();
        action();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const first = el.tree.querySelector('.file');
        if (first && !el.tree.contains(doc.activeElement)) {
          e.preventDefault();
          el.tree.querySelectorAll('.file').forEach((n) => n.setAttribute('tabindex', '-1'));
          first.setAttribute('tabindex', '0');
          first.focus();
        }
      }
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */

  async function start() {
    state.theme = store.get(STORAGE.theme, 'system');
    applyTheme();
    bindEvents();

    try {
      state.manifest = await loadManifest();
    } catch (err) {
      el.tree.innerHTML = `<p class="tree-msg">Could not read the manifest.<br><br>
        <code>${escapeHtml(err.message)}</code><br><br>
        Serve the repo with <code>npm run dev</code> and reload.</p>`;
      showError('Manifest unavailable', String(err.message));
      return;
    }

    state.files = flattenFiles(state.manifest);
    renderTree();

    const counts = state.manifest.counts || {};
    const statusTotal = doc.getElementById('status-count');
    if (statusTotal) {
      statusTotal.textContent = `${counts.files ?? state.files.length} artifacts · MIT`;
    }

    setDevice(store.get(STORAGE.device, 'fill'), { silent: true });
    const savedZoom = Number(store.get(STORAGE.zoom, 1));
    if (Number.isFinite(savedZoom) && savedZoom > 0) setZoom(savedZoom, { silent: true });

    const { path, device, zoom } = parseHash(win.location.hash);
    const target = path && state.files.some((f) => f.path === path) ? path : state.files[0]?.path;
    if (target) {
      navigate(target, { push: true, device: device || undefined, zoom: zoom || undefined });
    }
  }

  return { start, state, navigate, renderTree, setDevice, setZoom, cycleTheme, openPalette };
}

/* Only boot when running in a browser — Node imports this module for tests. */
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  createApp().start().catch((err) => {
    console.error('[OpenDesign] failed to start:', err);
  });
}
