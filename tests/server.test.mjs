/**
 * Integration tests for scripts/serve.mjs.
 *
 * The server is spawned for real on an ephemeral port and probed over HTTP, so
 * this covers the code path a browser actually hits: routing, content types,
 * directory indexes, 404s and the traversal guard.
 *
 * @license MIT
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child;
let base;

/** Ask the OS for a free port, then hand it to the server. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

const waitForServer = async (url, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server never came up at ${url}: ${lastError}`);
};

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs'), String(port)], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(`[serve] ${d}`));
  await waitForServer(`${base}/manifest.json`);
});

after(() => {
  child?.kill('SIGTERM');
});

test('serves the gallery shell', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.match(body, /OpenDesign/);
  assert.match(body, /id="tree"/);
});

test('serves manifest.json as JSON', async () => {
  const res = await fetch(`${base}/manifest.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  assert.equal(data.version, 2);
  assert.ok(data.sections.length >= 2);
});

test('serves the app module with a JS content type', async () => {
  const res = await fetch(`${base}/assets/app.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/javascript/);
});

test('serves the stylesheet and the favicon', async () => {
  const css = await fetch(`${base}/assets/styles.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  const icon = await fetch(`${base}/assets/favicon.svg`);
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type'), /image\/svg\+xml/);
});

test('a directory URL resolves to its index.html', async () => {
  const res = await fetch(`${base}/mockups/historia-que-recuerda/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /NOIACORE/);
});

test('every manifest path is fetchable over HTTP', async () => {
  const manifest = await (await fetch(`${base}/manifest.json`)).json();
  const paths = manifest.sections.flatMap((s) => s.groups.flatMap((g) => g.files.map((f) => f.path)));
  assert.ok(paths.length >= 4);
  for (const p of paths) {
    const res = await fetch(`${base}/${p}`);
    assert.equal(res.status, 200, `expected 200 for ${p}`);
  }
});

test('unknown paths 404 instead of leaking a stack', async () => {
  const res = await fetch(`${base}/does-not-exist.html`);
  assert.equal(res.status, 404);
  assert.match(await res.text(), /404/);
});

test('path traversal cannot escape the repository', async () => {
  for (const attack of [
    '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
    '/..%2f..%2f..%2fetc%2fpasswd',
    '/%2E%2E/%2E%2E/etc/passwd',
  ]) {
    const res = await fetch(`${base}${attack}`);
    assert.notEqual(res.status, 200, `${attack} should not resolve`);
    const body = await res.text();
    assert.ok(!/root:.*:0:0:/.test(body), `${attack} leaked /etc/passwd`);
  }
});

test('responses are not cached during development', async () => {
  const res = await fetch(`${base}/manifest.json`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
