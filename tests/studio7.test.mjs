/**
 * Tests for the Berentani Studio 7 mockup.
 *
 * Executes the page's real inline script in jsdom and drives the UI: entering the
 * lab, the transport, sealing a mix into localStorage, module navigation and the
 * guest-mode guard. No network, no APIs — exactly as the app runs.
 *
 * jsdom lacks a canvas backend and a modern CSS parser, so "Not implemented:
 * getContext" / "Could not parse CSS" noise is expected and filtered.
 *
 * @license MIT
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'mockups/berentani-studio-7/index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NOISE = /Not implemented|Could not parse CSS|getContext/;

async function boot() {
  const html = await readFile(file, 'utf8');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => { if (!NOISE.test(String(e.message || e))) errors.push(String(e.message || e)); });
  vc.on('error', (...a) => { const s = a.join(' '); if (!NOISE.test(s)) errors.push(s); });
  const dom = new JSDOM(html, {
    url: 'http://localhost/studio7/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.addEventListener('error', (e) => { if (!NOISE.test(String(e.message))) errors.push(String(e.message)); });
    },
  });
  await wait(60);
  return { dom, window: dom.window, document: dom.window.document, errors };
}
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));

test('cover shows first; entering reveals the laboratory', async () => {
  const { document, errors, dom } = await boot();
  try {
    assert.equal(document.body.classList.contains('in-lab'), false);
    assert.match(document.querySelector('.cover-title').textContent, /Berentani Studio 7/i);
    click(document.getElementById('enter-btn'));
    await wait(30);
    assert.equal(document.body.classList.contains('in-lab'), true);
    assert.equal(document.getElementById('operator-role').textContent, 'OPERADOR');
    assert.deepEqual(errors, [], `fatal: ${errors.join(' | ')}`);
  } finally { dom.window.close(); }
});

test('the transport starts the reactor and records state', async () => {
  const { document, errors, dom } = await boot();
  try {
    click(document.getElementById('enter-btn'));
    await wait(20);
    click(document.getElementById('t-play'));
    await wait(20);
    assert.equal(document.getElementById('reactor').classList.contains('live'), true);
    assert.match(document.getElementById('reactor-label').textContent, /activo/i);
    click(document.getElementById('t-pause'));
    await wait(20);
    assert.equal(document.getElementById('reactor').classList.contains('live'), false);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('sealing stores the mix in localStorage and shows it in Archivo 7', async () => {
  const { document, window, errors, dom } = await boot();
  try {
    click(document.getElementById('enter-btn'));
    await wait(20);
    click(document.getElementById('t-seal'));
    await wait(20);
    const seals = JSON.parse(window.localStorage.getItem('bs7_seals') || '[]');
    assert.equal(seals.length, 1);
    assert.match(seals[0].name, /SELLO-001/);
    assert.ok(seals[0].mix, 'the sealed mix records the fader values');
    assert.match(document.getElementById('toast').textContent, /Mezcla sellada en el Archivo 7/);

    // navigate to Archivo 7 and see the seal rendered
    const archMod = document.querySelector('[data-mod="arch"]');
    click(archMod);
    await wait(20);
    assert.match(document.getElementById('bench-title').textContent, /Archivo 7/);
    assert.match(document.getElementById('bench-body').textContent, /SELLO-001/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('guest mode can observe but not seal', async () => {
  const { document, window, errors, dom } = await boot();
  try {
    click(document.getElementById('guest-btn'));
    await wait(20);
    assert.equal(document.getElementById('operator-role').textContent, 'INVITADO');
    click(document.getElementById('t-seal'));
    await wait(20);
    const seals = JSON.parse(window.localStorage.getItem('bs7_seals') || '[]');
    assert.equal(seals.length, 0, 'a guest must not be able to seal');
    assert.match(document.getElementById('toast').textContent, /invitado/i);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('settings persist and re-apply the neon calibration', async () => {
  const { document, window, errors, dom } = await boot();
  try {
    click(document.getElementById('enter-btn'));
    await wait(20);
    click(document.querySelector('[data-mod="cfg"]'));
    await wait(20);
    const glow = document.getElementById('r-glow');
    glow.value = '160';
    glow.dispatchEvent(new window.Event('input', { bubbles: true }));
    await wait(10);
    assert.equal(document.documentElement.style.getPropertyValue('--glow'), '1.6');
    assert.equal(window.localStorage.getItem('bs7_glow'), '1.6');
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});

test('the page makes no network requests of any kind', async () => {
  const html = await readFile(file, 'utf8');
  assert.ok(!/<script[^>]+src=["'](https?:)?\/\//.test(html), 'no remote scripts');
  assert.ok(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["'](https?:)?\/\//.test(html), 'no remote stylesheets');
  assert.ok(!/fonts\.googleapis|cdnjs|unpkg|jsdelivr/.test(html), 'no font/CDN hosts');
  // fetch/XHR/WebSocket are never referenced
  assert.ok(!/\bfetch\(|XMLHttpRequest|new WebSocket/.test(html), 'no network APIs in the source');
});

test('the studio cover has a compact 320px layout with stacked usable actions', async () => {
  const source = await readFile(path.join(root, 'mockups/berentani-studio-7/index.html'), 'utf8');
  const mobile = source.match(/@media\s*\(max-width:\s*420px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(mobile, 'compact viewport breakpoint must exist');
  assert.match(mobile[1], /\.cover-title\s*\{[^}]*letter-spacing:\s*0\.07em/);
  assert.match(mobile[1], /\.cover-actions\s*\{[^}]*flex-direction:\s*column/);
  assert.match(mobile[1], /\.cover-actions \.btn\s*\{[^}]*justify-content:\s*center/);
});
