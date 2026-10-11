/**
 * End-to-end tests for the viewer shell.
 *
 * Loads the real index.html into jsdom and runs the real `createApp()` from
 * assets/app.js against it, with `fetch` served from the working tree. Nothing
 * here re-implements the viewer — it drives the shipped code.
 *
 * @license MIT
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createApp } from '../assets/app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const MANIFEST = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const EXPECTED_FILES = MANIFEST.sections.reduce(
  (n, sct) => n + sct.groups.reduce((m, g) => m + g.files.length, 0), 0);
const EXPECTED_MOCKUP_FILES = MANIFEST.sections.find((x) => x.id === 'mockups')
  .groups.reduce((m, g) => m + g.files.length, 0);
const FIRST_FILE = MANIFEST.sections[0].groups[0].files[0].path;

/** Minimal fetch(): resolves repo-relative URLs from disk. */
function makeFetch(requested = []) {
  return async (url) => {
    const clean = String(url).replace(/^\.?\//, '').split('?')[0];
    requested.push(clean);
    try {
      const body = await readFile(path.join(root, clean), 'utf8');
      return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    }
  };
}

async function boot({ hash = '', storage = {} } = {}) {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const virtualConsole = new VirtualConsole(); // keep jsdom's CSS noise out of the log
  const dom = new JSDOM(html, {
    url: `http://localhost/${hash}`,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
  const requested = [];
  window.fetch = makeFetch(requested);
  window.open = () => null;
  window.matchMedia = (media) => ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  window.Element.prototype.scrollIntoView = function scrollIntoView() {};

  const app = createApp(window.document, window);
  await app.start();
  await tick(25); // let the async preview fetch settle
  return { window, document: window.document, app, requested };
}

test('boots and indexes every artifact in both sections', async () => {
  const { document } = await boot();
  const files = [...document.querySelectorAll('.file')];
  assert.equal(files.length, EXPECTED_FILES, 'every artifact in the manifest must render');
  assert.equal(document.querySelectorAll('.section').length, MANIFEST.sections.length);
  assert.match(document.querySelector('.section-head').textContent, /Mockups/);
  assert.match(document.getElementById('status-count').textContent, new RegExp(EXPECTED_FILES + ' artifacts · MIT'));
});

test('the tree shows document titles and human-readable sizes', async () => {
  const { document } = await boot();
  const mockup = [...document.querySelectorAll('.file')].find((b) => b.dataset.path.endsWith('historia-que-recuerda/index.html'));
  assert.equal(mockup.querySelector('.file-title').textContent, 'NOIACORE — HISTORIA QUE RECUERDA');
  assert.match(mockup.querySelector('.file-size').textContent, /^\d+(\.\d+)? KB$/);
  assert.equal(mockup.querySelector('.file-icon').dataset.kind, 'html');
});

test('exactly one file row is tabbable at a time (valid roving tabindex)', async () => {
  const { document } = await boot();
  const values = [...document.querySelectorAll('.file')].map((b) => b.getAttribute('tabindex'));
  assert.deepEqual(values.filter((v) => !['0', '-1'].includes(v)), [], `invalid tabindex: ${values}`);
  assert.equal(values.filter((v) => v === '0').length, 1);
});

test('first artifact is previewed on a clean load', async () => {
  const { document, window } = await boot();
  const preview = document.getElementById('preview');
  assert.match(preview.getAttribute('src'), new RegExp(FIRST_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(document.getElementById('status-path').textContent, FIRST_FILE);
  assert.equal(document.getElementById('open-new').getAttribute('href'), FIRST_FILE);
  assert.equal(document.getElementById('placeholder').hidden, true);
  assert.equal(window.location.hash, '#/' + FIRST_FILE);
  assert.equal(document.querySelector('.file[aria-current="true"]').dataset.path, FIRST_FILE);
});

test('deep links open the referenced artifact directly', async () => {
  const { document } = await boot({ hash: '#/design-systems/restaurant-automation/README.md' });
  assert.equal(document.getElementById('status-path').textContent, 'design-systems/restaurant-automation/README.md');
  assert.equal(document.querySelector('.file[aria-current="true"]').dataset.path, 'design-systems/restaurant-automation/README.md');
  assert.match(document.querySelectorAll('#crumbs-list li')[0].textContent, /design-systems/);
  // Markdown is rendered, not dumped raw
  const srcdoc = document.getElementById('preview').getAttribute('srcdoc');
  assert.match(srcdoc, /<h1>Restaurant Automation/);
  assert.match(srcdoc, /<table>/);
  assert.match(srcdoc, /<blockquote>/);
  assert.ok(!srcdoc.includes('<script>alert'), 'markdown must be escaped');
});

test('a CSS token file renders as a swatch specimen', async () => {
  const { document, app } = await boot();
  app.navigate('design-systems/restaurant-automation/tokens/colors_and_type.css');
  await tick(5);
  const srcdoc = document.getElementById('preview').getAttribute('srcdoc');
  assert.match(srcdoc, /class="swatch"/);
  assert.match(srcdoc, /#000000/i);
  assert.match(srcdoc, /--color-accent-gold/);
  assert.match(srcdoc, /class="kind">CSS · \d+ tokens/);
});

test('a JSON token file renders its colour tokens', async () => {
  const { document, app } = await boot();
  app.navigate('design-systems/restaurant-automation/tokens/tokens.json');
  await tick(5);
  const srcdoc = document.getElementById('preview').getAttribute('srcdoc');
  assert.match(srcdoc, /color\.primitive\.black/);
  assert.match(srcdoc, /class="kind">JSON · \d+ tokens/);
});

test('the sidebar filter narrows the tree live', async () => {
  const { document } = await boot();
  const filter = document.getElementById('filter');
  filter.value = 'tokens.json';
  filter.dispatchEvent(ev(filter, 'input'));
  let visible = [...document.querySelectorAll('.file')];
  assert.equal(visible.length, 1);
  assert.match(visible[0].dataset.path, /tokens\.json$/);
  assert.equal(document.getElementById('filter-wrap').dataset.dirty, 'true');

  // a directory name matches everything inside it
  filter.value = 'tokens';
  filter.dispatchEvent(ev(filter, 'input'));
  visible = [...document.querySelectorAll('.file')].map((b) => b.dataset.path);
  assert.deepEqual(visible.sort(), [
    'design-systems/restaurant-automation/tokens/colors_and_type.css',
    'design-systems/restaurant-automation/tokens/tokens.json',
  ]);
});

function ev(node, type) {
  return new node.ownerDocument.defaultView.Event(type, { bubbles: true });
}

test('filtering away the selected row still leaves one tabbable row', async () => {
  const { document } = await boot();
  const filter = document.getElementById('filter');
  filter.value = 'tokens.json'; // exactly one match, not the selected artifact
  filter.dispatchEvent(ev(filter, 'input'));
  const values = [...document.querySelectorAll('.file')].map((b) => b.getAttribute('tabindex'));
  assert.equal(values.length, 1);
  assert.deepEqual(values, ['0']);
});

test('an unmatched filter says so instead of going blank', async () => {
  const { document } = await boot();
  const filter = document.getElementById('filter');
  filter.value = 'zzzzz';
  filter.dispatchEvent(ev(filter, 'input'));
  assert.equal(document.querySelectorAll('.file').length, 0);
  assert.match(document.querySelector('.tree-msg').textContent, /Nothing matches/);
});

test('switching viewport updates the frame, the radio group and the URL', async () => {
  const { document, window, app } = await boot();
  app.setDevice('mobile');
  await tick();
  const device = document.getElementById('device');
  assert.equal(device.dataset.shape, 'phone');
  assert.equal(device.dataset.mode, 'fixed');
  assert.equal(device.style.getPropertyValue('--dev-w'), '390px');
  assert.match(document.getElementById('status-view').textContent, /390×844/);
  assert.equal(document.querySelector('[data-device="mobile"]').getAttribute('aria-checked'), 'true');
  assert.equal(document.querySelector('[data-device="fill"]').getAttribute('aria-checked'), 'false');
  assert.match(window.location.hash, /device=mobile/);
});

test('viewport choice survives a reload', async () => {
  const second = await boot({ storage: { 'od.device': 'tablet' } });
  assert.equal(second.document.getElementById('device').style.getPropertyValue('--dev-w'), '834px');
});

test('zoom is clamped and reported', async () => {
  const { document, app } = await boot();
  app.setZoom(0.5);
  assert.equal(document.getElementById('zoom-read').textContent, '50%');
  app.setZoom(9);
  assert.equal(document.getElementById('zoom-read').textContent, '200%', 'clamped at 2x');
  app.setZoom(-3);
  assert.equal(document.getElementById('zoom-read').textContent, '20%', 'clamped at 0.2x');
});

test('the command palette ranks and opens artifacts', async () => {
  const { document, app } = await boot();
  app.openPalette();
  assert.equal(document.getElementById('palette').hidden, false);
  const q = document.getElementById('palette-q');
  q.value = 'readme';
  q.dispatchEvent(ev(q, 'input'));
  const items = [...document.querySelectorAll('.palette-item')];
  assert.ok(items.length >= 1);
  assert.match(items[0].dataset.path, /README\.md$/);
  assert.match(items[0].innerHTML, /<mark>/, 'matched characters are highlighted');
  items[0].dispatchEvent(ev(items[0], 'click'));
  await tick(5);
  assert.equal(document.getElementById('palette').hidden, true);
  assert.match(document.getElementById('status-path').textContent, /README\.md$/);
});

test('the palette reports a miss instead of an empty list', async () => {
  const { document, app } = await boot();
  app.openPalette();
  const q = document.getElementById('palette-q');
  q.value = 'no-such-thing';
  q.dispatchEvent(ev(q, 'input'));
  assert.match(document.querySelector('.palette-empty').textContent, /No artifact matches/);
});

test('keyboard: D cycles viewport, ? opens help, Esc closes it', async () => {
  const { document, window } = await boot();
  const press = (key) =>
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  press('d');
  assert.equal(document.querySelector('[data-device="desktop"]').getAttribute('aria-checked'), 'true');
  press('?');
  assert.equal(document.getElementById('help').hidden, false);
  press('Escape');
  assert.equal(document.getElementById('help').hidden, true);
  press('d');
  assert.equal(document.querySelector('[data-device="laptop"]').getAttribute('aria-checked'), 'true');
});

test('P toggles presentation mode and Esc leaves it', async () => {
  const { document } = await boot();
  const press = (key) =>
    document.dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  press('p');
  assert.equal(document.body.dataset.presentation, 'true');
  assert.equal(document.getElementById('present-toggle').getAttribute('aria-pressed'), 'true');
  press('Escape');
  assert.equal(document.body.dataset.presentation, 'false');
  assert.equal(document.getElementById('present-toggle').getAttribute('aria-pressed'), 'false');
});

test('the presentation button works without the keyboard', async () => {
  const { document } = await boot();
  const btn = document.getElementById('present-toggle');
  btn.dispatchEvent(ev(btn, 'click'));
  assert.equal(document.body.dataset.presentation, 'true');
  btn.dispatchEvent(ev(btn, 'click'));
  assert.equal(document.body.dataset.presentation, 'false');
});

test('⌘K opens the palette from anywhere', async () => {
  const { document, window } = await boot();
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }));
  assert.equal(document.getElementById('palette').hidden, false);
});

test('the source drawer loads and highlights the artifact source', async () => {
  const { document, app } = await boot();
  app.navigate('design-systems/restaurant-automation/tokens/tokens.json');
  await tick(5);
  document.getElementById('source-toggle').dispatchEvent(ev(document.getElementById('source-toggle'), 'click'));
  await tick(10);
  const drawer = document.getElementById('drawer');
  assert.equal(drawer.dataset.open, 'true');
  assert.equal(drawer.getAttribute('aria-hidden'), 'false');
  assert.equal(document.getElementById('drawer-path').textContent, 'design-systems/restaurant-automation/tokens/tokens.json');
  const body = document.getElementById('drawer-body').innerHTML;
  assert.match(body, /class="ln"/);
  assert.match(body, /tk-key/);
  assert.equal(document.getElementById('source-toggle').getAttribute('aria-pressed'), 'true');
});

test('theme cycles system → dark → light and persists', async () => {
  const { document, app } = await boot();
  assert.equal(document.documentElement.dataset.themeMode, 'system');
  app.cycleTheme();
  assert.equal(document.documentElement.dataset.themeMode, 'dark');
  assert.equal(document.documentElement.dataset.theme, 'dark');
  app.cycleTheme();
  assert.equal(document.documentElement.dataset.themeMode, 'light');
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(document.querySelector('meta[name="theme-color"]').getAttribute('content'), '#eceef2');
});

test('arrow keys walk the file list with a roving tabindex', async () => {
  const { document } = await boot();
  const files = [...document.querySelectorAll('.file')];
  files[0].focus();
  document.getElementById('tree').dispatchEvent(
    new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
  );
  assert.equal(document.activeElement, files[1]);
  assert.equal(files[1].getAttribute('tabindex'), '0');
  assert.equal(files[0].getAttribute('tabindex'), '-1');
});

test('hash navigation from the address bar switches the preview', async () => {
  const { document, window } = await boot();
  window.location.hash = '#/design-systems/restaurant-automation/tokens/tokens.json';
  window.dispatchEvent(new window.Event('hashchange'));
  await tick(10);
  assert.match(document.getElementById('status-path').textContent, /tokens\.json$/);
});

test('a missing artifact shows a recovery card, not a blank stage', async () => {
  const { document, app } = await boot();
  app.navigate('mockups/deleted/index.html');
  await tick();
  assert.equal(document.getElementById('placeholder').hidden, false);
  assert.match(document.querySelector('.error-card h2').textContent, /No artifact at that path/);
});

test('the shell makes no third-party requests', async () => {
  const { requested } = await boot();
  for (const url of requested) assert.ok(!/^https?:/.test(url), `unexpected remote fetch: ${url}`);
  assert.ok(requested.includes('manifest.json'), 'manifest should be fetched');
});

test('a broken manifest surfaces a readable failure', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', virtualConsole: new VirtualConsole(), runScripts: 'dangerously' });
  dom.window.fetch = async () => ({ ok: false, status: 500 });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const app = createApp(dom.window.document, dom.window);
  await app.start();
  await tick();
  assert.match(dom.window.document.querySelector('.tree-msg').textContent, /Could not read the manifest/);
  assert.match(dom.window.document.querySelector('.error-card').textContent, /npm run dev/);
});

test('falls back to manifest.js when fetch is unavailable (file:// case)', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const manifestJs = await readFile(path.join(root, 'manifest.js'), 'utf8');
  const dom = new JSDOM(html, { url: 'http://localhost/', virtualConsole: new VirtualConsole(), runScripts: 'dangerously' });
  dom.window.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {};
  dom.window.eval(manifestJs); // what <script src="manifest.js"> would have done
  const app = createApp(dom.window.document, dom.window);
  await app.start();
  await tick();
  assert.equal(dom.window.document.querySelectorAll('.file').length, EXPECTED_FILES);
});
