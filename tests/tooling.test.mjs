/**
 * Tests for the repo tooling: the offline-safety detector and the validator
 * itself, executed as a subprocess against the real repository.
 * @license MIT
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRemoteResources } from '../scripts/lib/offline.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('findRemoteResources flags loadable third-party resources', () => {
  const cases = [
    '<script src="https://cdn.example.com/x.js"></script>',
    '<link rel="stylesheet" href="https://fonts.example.com/a.css">',
    '<link href="//cdn.example.com/a.css" rel="stylesheet">',
    '<link rel="icon" href="https://cdn.example.com/i.png">',
    '<img src="https://cdn.example.com/i.png" alt="">',
    '<iframe src="https://example.com/embed"></iframe>',
    '<style>@import url(https://cdn.example.com/a.css);</style>',
    'body{background:url(//cdn.example.com/bg.png)}',
  ];
  for (const html of cases) {
    assert.ok(findRemoteResources(html).length > 0, `should flag: ${html}`);
  }
});

test('findRemoteResources allows metadata and local resources', () => {
  const cases = [
    '<link rel="canonical" href="https://example.github.io/repo/">',
    '<meta property="og:url" content="https://example.github.io/repo/">',
    '<a href="https://github.com/x/y" rel="noopener noreferrer">source</a>',
    '<link rel="stylesheet" href="assets/styles.css">',
    '<script src="manifest.js"></script>',
    '<script type="module" src="assets/app.js"></script>',
    '<img src="assets/favicon.svg" alt="">',
    '<iframe src="./mockups/a/index.html"></iframe>',
  ];
  for (const html of cases) {
    assert.deepEqual(findRemoteResources(html), [], `should not flag: ${html}`);
  }
});

test('the <style> rule stops at </style> instead of running into later tags', () => {
  const hits = findRemoteResources('<style>a{color:red}</style><script src="https://cdn.example.com/x.js"></script>');
  assert.equal(hits.length, 1);
  assert.match(hits[0], /^<script src>/);
  // a remote reference that really is inside the style block is still caught
  const inner = findRemoteResources('<style>@font-face{src:url(https://cdn.example.com/f.woff2)}</style>');
  assert.ok(inner.some((h) => h.startsWith('css url()') || h.startsWith('remote reference')), inner.join(' | '));
});

test('the committed shell is offline-safe', async () => {
  const shell = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.deepEqual(findRemoteResources(shell), []);
});

test('the mockup is offline-safe (its CDN script tag is the documented exception)', async () => {
  const mockup = await readFile(path.join(root, 'mockups/historia-que-recuerda/index.html'), 'utf8');
  const hits = findRemoteResources(mockup);
  // three.js + Google Fonts are the only remote loads, and the page degrades without them.
  assert.equal(hits.length, 2, `unexpected remote loads: ${hits.join(' | ')}`);
  assert.match(mockup, /typeof THREE==='undefined'/, 'must degrade when the CDN is blocked');
});

test('npm run validate passes on this repository', async () => {
  const { stdout } = await run(process.execPath, [path.join(root, 'scripts/validate.mjs')]);
  assert.match(stdout, /all clean — \d+ checks passed/);
});

test('npm run build --check reports no drift', async () => {
  const { stdout } = await run(process.execPath, [path.join(root, 'scripts/build-manifest.mjs'), '--check']);
  assert.match(stdout, /manifest up to date/);
});

test('the dev server refuses path traversal', async () => {
  const src = await readFile(path.join(root, 'scripts/serve.mjs'), 'utf8');
  assert.match(src, /startsWith\(root \+ path\.sep\)/);
  assert.match(src, /403 Forbidden/);
  assert.match(src, /'0\.0\.0\.0'/, 'must bind all interfaces so it can be previewed');
});
