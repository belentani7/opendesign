/**
 * Unit tests for the viewer's pure helpers.
 * These import the real module the browser runs — no re-implementation.
 * @license MIT
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICES,
  buildHash,
  escapeHtml,
  flattenFiles,
  flattenTokens,
  formatBytes,
  fuzzyMatch,
  highlight,
  parseCssTokens,
  parseHash,
  pathSegments,
  renderMarkdown,
  safeUrl,
  searchFiles,
  withLineNumbers,
} from '../assets/app.js';

test('formatBytes renders human sizes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(987), '987 B');
  assert.equal(formatBytes(17757), '17 KB');
  assert.equal(formatBytes(1024 * 1024 * 3), '3 MB');
  assert.equal(formatBytes(-1), '—');
  assert.equal(formatBytes('nope'), '—');
});

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<img src=x onerror="1">'), '&lt;img src=x onerror=&quot;1&quot;&gt;');
  assert.equal(escapeHtml(`it's & "quoted"`), 'it&#39;s &amp; &quot;quoted&quot;');
  assert.equal(escapeHtml(null), '');
});

test('parseHash reads deep links', () => {
  assert.deepEqual(parseHash(''), { path: '', device: '', zoom: '' });
  assert.deepEqual(parseHash('#/mockups/a/index.html'), {
    path: 'mockups/a/index.html',
    device: '',
    zoom: '',
  });
  assert.deepEqual(parseHash('#/mockups/a/index.html?device=mobile&zoom=0.5'), {
    path: 'mockups/a/index.html',
    device: 'mobile',
    zoom: '0.5',
  });
  // percent-encoded segments survive the round trip
  assert.deepEqual(parseHash('#/mockups/dise%C3%B1o/index.html').path, 'mockups/diseño/index.html');
  // malformed encoding must not throw
  assert.equal(parseHash('#/mockups/%E0%A4%A/index.html').path, 'mockups/%E0%A4%A/index.html');
});

test('buildHash round-trips through parseHash', () => {
  const hash = buildHash({ path: 'mockups/a b/index.html', device: 'mobile', zoom: 0.5 });
  const parsed = parseHash(hash);
  assert.equal(parsed.path, 'mockups/a b/index.html');
  assert.equal(parsed.device, 'mobile');
  assert.equal(parsed.zoom, '0.5');
});

test('buildHash drops defaults to keep URLs short', () => {
  assert.equal(buildHash({ path: 'x.html' }), '#/x.html');
  assert.equal(buildHash({ path: 'x.html', device: 'fill', zoom: 1 }), '#/x.html');
});

test('fuzzyMatch prefers exact and early matches', () => {
  assert.ok(fuzzyMatch('index', 'index.html').score > fuzzyMatch('index', 'mockups/x/index.html').score);
  assert.equal(fuzzyMatch('zzz', 'index.html'), null);
  assert.equal(fuzzyMatch('', 'anything').score, 1);
  const sub = fuzzyMatch('hq', 'historia-que-recuerda');
  assert.ok(sub, 'subsequence should match');
  assert.deepEqual(sub.indices, [0, 9]);
});

test('searchFiles ranks label hits above path hits', () => {
  const files = [
    { label: 'index.html', path: 'mockups/tokens-demo/index.html', kind: 'html', group: 'tokens-demo', section: 'mockups' },
    { label: 'tokens.json', path: 'design-systems/tokens/tokens.json', kind: 'json', group: 'tokens', section: 'design-systems' },
  ];
  const results = searchFiles(files, 'tokens.json');
  assert.equal(results[0].file.label, 'tokens.json');
  assert.equal(searchFiles(files, '').length, 2);
  assert.equal(searchFiles(files, 'nothing-matches').length, 0);
});

test('flattenFiles keeps group + section context', () => {
  const manifest = {
    sections: [
      {
        id: 'mockups',
        label: 'Mockups',
        groups: [{ slug: 'a', label: 'A', files: [{ label: 'index.html', path: 'mockups/a/index.html' }] }],
      },
    ],
  };
  const [file] = flattenFiles(manifest);
  assert.equal(file.group, 'a');
  assert.equal(file.section, 'mockups');
  assert.equal(file.kind, 'binary', 'missing kind falls back to binary');
  assert.deepEqual(flattenFiles(null), []);
});

test('pathSegments splits and drops empties', () => {
  assert.deepEqual(pathSegments('/a/b/c.html'), ['a', 'b', 'c.html']);
  assert.deepEqual(pathSegments(''), []);
});

test('parseCssTokens separates colours from the scale', () => {
  const css = `:root{
    --color-bg-primary: #000000;
    --color-text-secondary: var(--color-gray-700);
    --font-size-display-xl: 48px;
    --shadow-lg: 0 10px 15px rgba(0,0,0,.4);
  }`;
  const { colors, sizes, others } = parseCssTokens(css);
  assert.deepEqual(colors.map((c) => c.name), ['--color-bg-primary', '--color-text-secondary']);
  assert.deepEqual(sizes.map((c) => c.name), ['--font-size-display-xl']);
  assert.deepEqual(others.map((c) => c.name), ['--shadow-lg']);
});

test('flattenTokens walks DTCG-style token files', () => {
  const tokens = flattenTokens({
    color: {
      primitive: { black: { value: '#000000', type: 'color' } },
      semantic: { background: { primary: { value: '{color.primitive.black}', type: 'color' } } },
    },
    spacing: { 4: { value: '16px', type: 'dimension' } },
  });
  assert.equal(tokens.length, 3);
  assert.equal(tokens[0].name, 'color.primitive.black');
  assert.equal(tokens.find((t) => t.name === 'spacing.4').value, '16px');
  assert.deepEqual(flattenTokens(null), []);
});

test('renderMarkdown covers the subset the docs use', () => {
  const html = renderMarkdown(`# Title

Some **bold** and \`code\` and [a link](https://example.com).

- one
- two

1. first

> quoted

| a | b |
| --- | --- |
| 1 | 2 |

\`\`\`css
.card { color: red; }
\`\`\`

---
`);
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<a href="https:\/\/example\.com">a link<\/a>/);
  assert.match(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assert.match(html, /<ol>\n<li>first<\/li>\n<\/ol>/);
  assert.match(html, /<blockquote>quoted<\/blockquote>/);
  assert.match(html, /<table><thead><tr><th>a<\/th><th>b<\/th>/);
  assert.match(html, /<pre><code class="lang-css">/);
  assert.match(html, /<hr>/);
});

test('renderMarkdown never emits raw markup from the source', () => {
  const html = renderMarkdown('# <script>alert(1)</script>');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
});

test('safeUrl blocks scriptable link targets', () => {
  assert.equal(safeUrl('https://example.com/a?b=1&c=2'), 'https://example.com/a?b=1&c=2');
  assert.equal(safeUrl('./tokens/tokens.json'), './tokens/tokens.json');
  assert.equal(safeUrl('#section'), '#section');
  assert.equal(safeUrl('mailto:hi@example.com'), 'mailto:hi@example.com');
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('JaVaScRiPt:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,<script>1</script>'), '#');
});

test('renderMarkdown neutralises javascript: links', () => {
  const html = renderMarkdown('[click](javascript:alert(1)) and ![img](data:text/html,x)');
  assert.ok(!/href="javascript:/i.test(html), html);
  assert.ok(!/src="data:/i.test(html), html);
  assert.match(html, /<a href="#">click<\/a>/);
});

test('highlight escapes first, then colourises', () => {
  const out = highlight('<div class="x">hi</div>', 'html');
  assert.ok(!out.includes('<div class="x">hi</div>'), 'raw markup must be escaped');
  assert.match(out, /&lt;div/);
  assert.match(out, /tk-tag/);
  const json = highlight('{"a": 1, "b": true}', 'json');
  assert.match(json, /tk-key/);
  assert.match(json, /tk-num/);
  assert.equal(highlight('plain text', 'text'), 'plain text');
});

test('withLineNumbers emits one row per line', () => {
  const rows = withLineNumbers('a\nb\nc').match(/class="ln"/g);
  assert.equal(rows.length, 3);
});

test('DEVICES covers the advertised viewports', () => {
  assert.deepEqual(
    DEVICES.map((d) => d.id),
    ['fill', 'desktop', 'laptop', 'tablet', 'mobile'],
  );
  assert.equal(DEVICES.find((d) => d.id === 'mobile').w, 390);
});
