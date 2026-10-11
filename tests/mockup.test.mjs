/**
 * Regression tests for the mockup in mockups/historia-que-recuerda/.
 *
 * The page used to declare `mx`/`my` inside init3D() while its sibling tick()
 * read them, so every animation frame threw `ReferenceError: mx is not defined`
 * and the canvas stayed black. These tests execute the page's real inline script
 * in jsdom with a three.js stand-in and fail if it throws again.
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
const file = path.join(root, 'mockups/historia-que-recuerda/index.html');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** A permissive stand-in for the three.js namespace: every access is chainable. */
function threeStub() {
  const target = function noop() {};
  const stub = new Proxy(target, {
    get(t, prop) {
      if (prop === 'then') return undefined; // never look like a thenable
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === 'length' || prop === 'name') return 0;
      return stub;
    },
    set: () => true,
    has: () => true,
    apply: () => stub,
    construct: () => stub,
  });
  return stub;
}

async function runMockup({ withThree = true, seed = {} } = {}) {
  const html = await readFile(file, 'utf8');
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e.message || e)));
  virtualConsole.on('error', (...args) => errors.push(args.join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost/mockup/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      for (const [k, v] of Object.entries(seed)) window.localStorage.setItem(k, v);
      window.WebGLRenderingContext = function WebGLRenderingContext() {};
      if (withThree) window.THREE = threeStub();
      window.addEventListener('error', (e) => errors.push(String(e.message)));
      window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));
    },
  });
  // init3D is scheduled 300 ms after parse; give it a few frames.
  await wait(520);
  return { dom, window: dom.window, errors };
}

test('the mockup boots without throwing in its render loop (regression: mx/my scope)', async () => {
  const { window, errors, dom } = await runMockup();
  try {
    const fatal = errors.filter((e) => /ReferenceError|TypeError|is not defined|is not a function/.test(e));
    assert.deepEqual(fatal, [], `page threw: ${fatal.join(' | ')}`);
    assert.equal(window.document.getElementById('visitCount').textContent, '1');
    assert.equal(window.localStorage.getItem('noia_visits'), '1');
    assert.equal(window.document.body.classList.contains('no3d'), false, 'WebGL path was taken');
    assert.match(window.document.getElementById('title').innerHTML, /ojo/);
  } finally {
    dom.window.close();
  }
});

test('the state machine advances and names the visitor', async () => {
  // A returning visitor: the saved name makes the page render the Phi signature.
  const { window, errors, dom } = await runMockup({ seed: { noia_name: 'Belen', noia_visits: '4' } });
  try {
    const doc = window.document;
    const input = doc.getElementById('nameInput');
    input.value = 'Arena';
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait(20);
    assert.match(doc.getElementById('title').textContent, /ARENA/);
    assert.equal(window.localStorage.getItem('noia_name'), 'Arena');
    // Phi signature is rendered for a returning visitor
    const sig = doc.getElementById('phiSig');
    assert.ok(sig, 'returning visitor should get a Phi signature block');
    assert.match(sig.textContent, /^[()·◯]+$/, 'signature is a parenthesised Zeckendorf bit string');
    assert.equal(doc.getElementById('visitCount').textContent, '5', 'visit counter incremented');
    assert.deepEqual(
      errors.filter((e) => /ReferenceError|TypeError/.test(e)),
      [],
    );
  } finally {
    dom.window.close();
  }
});

test('a blocked three.js CDN degrades to the CSS backdrop instead of a dead page', async () => {
  const { window, errors, dom } = await runMockup({ withThree: false });
  try {
    await wait(60);
    assert.equal(window.document.body.classList.contains('no3d'), true);
    assert.ok(!window.document.getElementById('title').innerHTML.includes('undefined'));
    assert.deepEqual(
      errors.filter((e) => /ReferenceError|TypeError/.test(e)),
      [],
      'missing three.js must not throw',
    );
  } finally {
    dom.window.close();
  }
});

test('removed three.js API is no longer used (regression: outputEncoding/sRGBEncoding)', async () => {
  const src = await readFile(file, 'utf8');
  assert.ok(!/outputEncoding/.test(src), 'three.js removed outputEncoding in r155');
  assert.ok(!/sRGBEncoding/.test(src), 'three.js removed sRGBEncoding in r155');
  assert.match(src, /outputColorSpace/);
});

test('accumulated time uses the load-time baseline (regression: quadratic counter)', async () => {
  const src = await readFile(file, 'utf8');
  // Old code re-read localStorage on every tick and added the session again.
  assert.ok(
    !/NUM\('noia_total_time',0\)\+/.test(src),
    'total time must not re-read and re-add the session on every interval',
  );
  assert.match(src, /lastTime\+Math\.floor\(\(performance\.now\(\)-sessionStart\)\/1000\)/);
});

test('visitor localStorage keys are not dumped to the console', async () => {
  const src = await readFile(file, 'utf8');
  assert.ok(!/Object\.keys\(localStorage\)/.test(src));
});

test('the .knows state lands on the element the CSS targets (regression)', async () => {
  const src = await readFile(file, 'utf8');
  assert.match(src, /\$\('#mid'\)\.className/);
});
