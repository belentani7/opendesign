#!/usr/bin/env node
/**
 * OpenDesign — repository validator.
 *
 * Replaces the old CI step that only checked "index.html is not empty".
 * Every rule below failed at least once in the pre-2.0 history of this repo.
 *
 *   1. manifest.json parses and matches the schema version
 *   2. `generated` holds a real ISO timestamp (the old one shipped "$ts")
 *   3. every path in the manifest exists on disk
 *   4. every artifact on disk is reachable from the manifest (no orphans)
 *   5. every *.html parses as a document: doctype, lang, charset, viewport,
 *      title, balanced-enough tags, and no dead local href/src targets
 *   6. every *.json is valid JSON
 *   7. the shell (index.html) declares the SEO/social meta tags it advertises
 *
 * Exit code 1 on the first failing group, 0 when clean.
 *
 * @license MIT
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_VERSION, SECTIONS } from './lib/manifest.mjs';
import { findRemoteResources } from './lib/offline.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
let checks = 0;

const ok = (label) => {
  checks += 1;
  console.log(`  ✔ ${label}`);
};
const fail = (label, detail) => {
  problems.push(`${label}: ${detail}`);
  console.log(`  ✖ ${label} — ${detail}`);
};

const read = (rel) => readFile(path.join(root, rel), 'utf8');
const exists = async (rel) => {
  try {
    await stat(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
};

async function walk(dir, out = []) {
  let entries;
  try {
    const { readdir } = await import('node:fs/promises');
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    throw err;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) await walk(rel, out);
    else out.push(rel);
  }
  return out;
}

console.log('OpenDesign validator\n');

/* ── 1-4: manifest ─────────────────────────────────────────────── */
console.log('manifest.json');
let manifest = null;
try {
  manifest = JSON.parse(await read('manifest.json'));
  ok('parses as JSON');
} catch (err) {
  fail('parses as JSON', err.message);
}

if (manifest) {
  manifest.version === MANIFEST_VERSION
    ? ok(`schema version ${manifest.version}`)
    : fail('schema version', `expected ${MANIFEST_VERSION}, got ${manifest.version}`);

  const generated = manifest.generated;
  const isIso = typeof generated === 'string' && !Number.isNaN(Date.parse(generated));
  isIso ? ok(`generated timestamp (${generated})`) : fail('generated timestamp', `unparseable value ${JSON.stringify(generated)}`);

  if (!Array.isArray(manifest.sections) || manifest.sections.length === 0) {
    fail('sections', 'missing or empty');
  } else {
    ok(`${manifest.sections.length} section(s)`);
  }

  const declared = [];
  for (const section of manifest.sections ?? []) {
    for (const group of section.groups ?? []) {
      for (const file of group.files ?? []) {
        declared.push(file.path);
        (await exists(file.path))
          ? checks++
          : fail(`path exists: ${file.path}`, 'referenced by manifest but not on disk');
        if (!file.kind) fail(`kind: ${file.path}`, 'missing kind');
        if (typeof file.bytes !== 'number') fail(`bytes: ${file.path}`, 'missing byte size');
      }
    }
  }
  ok(`${declared.length} declared path(s) resolved`);

  // Orphan check: anything on disk under a scanned section must be indexed.
  const onDisk = [];
  for (const section of SECTIONS) onDisk.push(...(await walk(section.dir)));
  const missing = onDisk.filter((rel) => !declared.includes(rel));
  missing.length === 0
    ? ok(`no orphaned artifacts (${onDisk.length} on disk, all indexed)`)
    : fail('orphaned artifacts', missing.join(', '));

  const dupes = declared.filter((p, i) => declared.indexOf(p) !== i);
  dupes.length === 0 ? ok('no duplicate paths') : fail('duplicate paths', [...new Set(dupes)].join(', '));
}

/* ── 5-6: every artifact parses ────────────────────────────────── */
console.log('\nartifacts');
const htmlFiles = [];
const jsonFiles = [];
for (const section of SECTIONS) {
  for (const rel of await walk(section.dir)) {
    if (rel.endsWith('.html')) htmlFiles.push(rel);
    if (rel.endsWith('.json')) jsonFiles.push(rel);
  }
}
for (const rel of ['index.html', '404.html']) if (await exists(rel)) htmlFiles.unshift(rel);

for (const rel of htmlFiles) {
  const src = await read(rel);
  const errs = [];
  if (!/^\s*<!doctype html>/i.test(src)) errs.push('missing <!DOCTYPE html>');
  if (!/<html[^>]*\slang=/i.test(src)) errs.push('<html> has no lang');
  if (!/<meta[^>]*charset/i.test(src)) errs.push('no charset meta');
  if (!/<meta[^>]*name=["']viewport["']/i.test(src)) errs.push('no viewport meta');
  if (!/<title[^>]*>\s*\S/i.test(src)) errs.push('no <title>');
  for (const tag of ['div', 'section', 'main', 'aside', 'nav', 'header', 'footer', 'body', 'html', 'style', 'script']) {
    const open = (src.match(new RegExp(`<${tag}(?=[\\s>])`, 'gi')) || []).length;
    const close = (src.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (open !== close) errs.push(`unbalanced <${tag}> (${open} open / ${close} close)`);
  }
  // Local (same-repo) links must resolve; remote URLs are not our business here.
  for (const m of src.matchAll(/(?:href|src)=["'](\.[^"']*)["']/g)) {
    const target = m[1].split('?')[0].split('#')[0];
    if (!target) continue;
    if (!(await exists(target))) errs.push(`dead local link: ${m[1]}`);
  }
  errs.length === 0 ? ok(rel) : fail(rel, errs.join('; '));
}

for (const rel of jsonFiles) {
  try {
    JSON.parse(await read(rel));
    ok(rel);
  } catch (err) {
    fail(rel, err.message);
  }
}

/* ── 7: shell SEO + offline-safety ─────────────────────────────── */
console.log('\nshell (index.html)');
const shell = await read('index.html');
const required = [
  [/name=["']description["']/, 'meta description'],
  [/rel=["']icon["']/, 'favicon'],
  [/property=["']og:title["']/, 'og:title'],
  [/name=["']theme-color["']/, 'theme-color'],
  [/manifest\.js/, 'file:// manifest fallback'],
];
for (const [re, label] of required) {
  re.test(shell) ? ok(label) : fail(label, 'not declared in index.html');
}
const remote = findRemoteResources(shell);
remote.length === 0
  ? ok('no third-party resource loads (works offline, no tracking, no cost)')
  : fail('offline-safe', remote.join(' | '));

const license = await read('LICENSE');
/MIT License/.test(license) ? ok('LICENSE is MIT') : fail('LICENSE', 'expected MIT text');
const readme = await read('README.md');
/SPDX-License-Identifier: MIT|License: MIT|MIT License/i.test(readme)
  ? ok('README states the MIT license')
  : fail('README license', 'license not stated');

console.log('');
if (problems.length) {
  console.error(`✖ ${problems.length} problem(s) across ${checks} checks`);
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}
console.log(`✔ all clean — ${checks} checks passed`);
