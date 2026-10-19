const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const read = file => readFileSync(join(__dirname, '..', file), 'utf8');

test('Vercel builds the type-checked Vite application with a frozen installation', () => {
  const deployment = JSON.parse(read('vercel.json'));
  const manifest = JSON.parse(read('package.json'));
  assert.equal(deployment.framework, 'vite');
  assert.equal(deployment.installCommand, 'bun install --frozen-lockfile');
  assert.equal(deployment.buildCommand, 'bun run build');
  assert.equal(deployment.outputDirectory, 'dist');
  assert.match(manifest.scripts.build, /tsc --noEmit && vite build/);
  assert.match(manifest.scripts.test, /tests\/\*\.test\.tsx/);
});

test('the Bun workspace lock agrees with the pinned dependency manifest', () => {
  const manifest = JSON.parse(read('package.json'));
  // Bun text locks allow trailing commas, but otherwise use JSON for this graph.
  const lock = JSON.parse(read('bun.lock').replace(/,\s*([}\]])/g, '$1'));
  assert.deepEqual(lock.workspaces[''].dependencies, manifest.dependencies);
  assert.deepEqual(lock.workspaces[''].devDependencies, manifest.devDependencies);
});
