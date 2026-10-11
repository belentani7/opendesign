#!/usr/bin/env node
/**
 * OpenDesign — manifest builder.
 *
 * Scans `mockups/` and `design-systems/`, then writes:
 *   manifest.json  — the canonical index (fetched over HTTP)
 *   manifest.js    — the same data as a plain script, so the viewer also works
 *                    when opened straight from disk via `file://` (where fetch
 *                    of a local file is blocked by browsers).
 *
 * Usage:
 *   node scripts/build-manifest.mjs            write both files
 *   node scripts/build-manifest.mjs --check    exit 1 if they are stale (CI)
 *
 * @license MIT
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, manifestsMatch } from './lib/manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'manifest.json');
const jsPath = path.join(root, 'manifest.js');
const check = process.argv.includes('--check');

const manifest = await buildManifest(root);
manifest.generated = new Date().toISOString();

const jsonBody = `${JSON.stringify(manifest, null, 2)}\n`;
const jsBody = [
  '/* GENERATED FILE — do not edit by hand. Run `npm run build`. */',
  '/* OpenDesign manifest fallback for file:// usage. @license MIT */',
  `window.OpenDesignManifest = ${JSON.stringify(manifest, null, 2)};`,
  '',
].join('\n');

if (check) {
  let ok = true;
  try {
    const existing = JSON.parse(await readFile(jsonPath, 'utf8'));
    if (!manifestsMatch(existing, manifest)) {
      ok = false;
      console.error('✖ manifest.json is stale — run `npm run build` and commit the result.');
    }
  } catch {
    ok = false;
    console.error('✖ manifest.json is missing or not valid JSON — run `npm run build`.');
  }
  try {
    const existingJs = await readFile(jsPath, 'utf8');
    if (existingJs !== jsBody.replace(/^\s*generated.*\n/m, '') && !existingJs.includes('"version"')) {
      ok = false;
    }
  } catch {
    ok = false;
    console.error('✖ manifest.js is missing — run `npm run build`.');
  }
  if (!ok) process.exit(1);
  console.log(
    `✔ manifest up to date — ${manifest.counts.files} file(s), ` +
      `${manifest.counts.mockups} mockup(s), ${manifest.counts.designSystems} design-system file(s).`,
  );
  process.exit(0);
}

await writeFile(jsonPath, jsonBody, 'utf8');
await writeFile(jsPath, jsBody, 'utf8');
console.log(`✔ wrote manifest.json + manifest.js — ${manifest.counts.files} file(s) indexed`);
for (const section of manifest.sections) {
  for (const group of section.groups) {
    for (const file of group.files) {
      console.log(`   · ${file.path} (${file.kind}, ${file.bytes} B)`);
    }
  }
}
