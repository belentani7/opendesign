#!/usr/bin/env node
/**
 * OpenDesign — development server.
 *
 * Zero dependencies (node:http only). Exists because `fetch('./manifest.json')`
 * is blocked on `file://`, so a server is needed for the full experience.
 *
 *   node scripts/serve.mjs [port]     default 8080, binds 0.0.0.0
 *
 * @license MIT
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';

  // Resolve inside the repo and refuse traversal (`/../../etc/passwd`).
  const abs = path.resolve(root, `.${rel}`);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  try {
    const info = await stat(abs);
    const target = info.isDirectory() ? path.join(abs, 'index.html') : abs;
    const ext = path.extname(target).toLowerCase();
    const stream = createReadStream(target);
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    stream.pipe(res);
    stream.on('error', () => res.destroy());
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>404</title><h1>404 — not found</h1>');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`OpenDesign → http://0.0.0.0:${port}  (repo: ${root})`);
});
