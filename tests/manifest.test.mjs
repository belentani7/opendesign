/**
 * Manifest tests: the committed index must match what a fresh scan produces,
 * and every entry must point at a file that exists.
 * @license MIT
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, humanize, manifestsMatch, readTitle } from '../scripts/lib/manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const committed = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

test('committed manifest matches a fresh scan (no stale index)', async () => {
  const fresh = await buildManifest(root);
  assert.ok(
    manifestsMatch(committed, fresh),
    'manifest.json is stale — run `npm run build` and commit the result',
  );
});

test('manifest declares a real generated timestamp (regression: "$ts")', () => {
  assert.notEqual(committed.generated, '$ts');
  assert.ok(!Number.isNaN(Date.parse(committed.generated)), `unparseable: ${committed.generated}`);
});

test('every manifest path exists on disk', async () => {
  const paths = [];
  for (const section of committed.sections) {
    for (const group of section.groups) for (const file of group.files) paths.push(file.path);
  }
  assert.ok(paths.length >= 3, `expected the known artifacts, got ${paths.length}`);
  for (const p of paths) {
    const info = await stat(path.join(root, p)).catch(() => null);
    assert.ok(info, `missing file: ${p}`);
  }
});

test('manifest byte counts match the files', async () => {
  for (const section of committed.sections) {
    for (const group of section.groups) {
      for (const file of group.files) {
        const info = await stat(path.join(root, file.path));
        assert.equal(file.bytes, info.size, `byte count drifted for ${file.path}`);
      }
    }
  }
});

test('counts block agrees with the sections', () => {
  const all = committed.sections.flatMap((s) => s.groups.flatMap((g) => g.files));
  assert.equal(committed.counts.files, all.length);
  const ds = committed.sections.find((s) => s.id === 'design-systems');
  assert.equal(committed.counts.designSystems, ds.groups.flatMap((g) => g.files).length);
});

test('the design-systems section is no longer empty (regression)', () => {
  const ds = committed.sections.find((s) => s.id === 'design-systems');
  assert.ok(ds.groups.length > 0, 'design-systems had 0 groups before 2.0');
  const labels = ds.groups.flatMap((g) => g.files.map((f) => f.label));
  assert.ok(labels.includes('tokens.json'));
  assert.ok(labels.includes('colors_and_type.css'));
});

test('readTitle extracts and unescapes <title>', () => {
  assert.equal(readTitle('<html><head><title>A &amp; B</title></head></html>'), 'A & B');
  assert.equal(readTitle('<html><head></head></html>', 'fallback'), 'fallback');
  assert.equal(readTitle('<title>  Spaced   out  </title>'), 'Spaced out');
});

test('humanize turns slugs into labels', () => {
  assert.equal(humanize('historia-que-recuerda'), 'Historia que recuerda');
  assert.equal(humanize('a_b_c'), 'A b c');
});
