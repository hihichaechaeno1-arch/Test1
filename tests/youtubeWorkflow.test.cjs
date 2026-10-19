const assert = require('node:assert/strict');
const { readFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const root = resolve(__dirname, '..');
const workflow = readFileSync(join(root, '.github/workflows/auto-update.yml'), 'utf8');
const channelId = `UC${'a'.repeat(22)}`;
const configured = {
  ENABLE_YOUTUBE_SYNC: 'true',
  YOUTUBE_CHANNEL_IDS: channelId,
  YOUTUBE_API_KEY: 'private-youtube-fixture',
  SUPABASE_URL: 'https://private-fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'private-service-fixture',
};

// Invoke the actual workflow command, not a parallel implementation of its gate.
function preflight(env) {
  const step = workflow.match(/      - name: Validate sync configuration\n([\s\S]*?)(?=      - |$)/)?.[1];
  assert.ok(step, 'scheduled/manual runs must execute a configuration preflight');
  assert.doesNotMatch(step, /^        (?:if|continue-on-error):/m);
  const command = step.match(/^        run: node (\S+)$/m)?.[1];
  assert.ok(command, 'preflight must execute the tested Node CLI');
  for (const name of Object.keys(configured)) {
    const source = ['ENABLE_YOUTUBE_SYNC', 'YOUTUBE_CHANNEL_IDS'].includes(name) ? 'vars' : 'secrets';
    assert.ok(step.includes(`${name}: \${{ ${source}.${name} }}`), `${name} must be passed to preflight`);
  }
  const directory = mkdtempSync(join(tmpdir(), 'youtube-preflight-'));
  try {
    const summaryPath = join(directory, 'summary.md');
    const result = spawnSync(process.execPath, [join(root, command)], {
      cwd: root,
      env: { ...env, GITHUB_STEP_SUMMARY: summaryPath },
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.ifError(result.error);
    const summary = readFileSync(summaryPath, 'utf8');
    return { status: result.status, output: result.stdout + result.stderr, summary };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('scheduled and manual sync jobs cannot silently skip configuration validation', () => {
  assert.match(workflow, /cron: '0 0,12 \* \* \*'/);
  assert.match(workflow, /^  workflow_dispatch:/m);
  const jobHeader = workflow.match(/^  update-videos:\n([\s\S]*?)^    steps:/m)?.[1];
  assert.ok(jobHeader);
  assert.doesNotMatch(jobHeader, /^    if:/m, 'a missing repository variable must not skip the entire job');
  assert.ok(workflow.indexOf('name: Validate sync configuration') < workflow.indexOf('uses: oven-sh/setup-bun'));
  assert.ok(workflow.indexOf('name: Validate sync configuration') < workflow.indexOf('run: bun install'));
});

test('the observed missing variables fail visibly and report both blockers without credentials', () => {
  const { ENABLE_YOUTUBE_SYNC, YOUTUBE_CHANNEL_IDS, ...secrets } = configured;
  const result = preflight(secrets);
  assert.equal(result.status, 1);
  assert.match(result.output, /::error::.*ENABLE_YOUTUBE_SYNC/);
  assert.match(result.output, /::error::.*YOUTUBE_CHANNEL_IDS/);
  assert.match(result.summary, /Configuration blocked/);
  assert.match(result.summary, /ENABLE_YOUTUBE_SYNC/);
  assert.match(result.summary, /YOUTUBE_CHANNEL_IDS/);
  assert.match(result.summary, /No YouTube requests or database writes/);
  for (const value of Object.values(secrets)) {
    assert.ok(!(result.output + result.summary).includes(value));
  }
});

test('setting only the enable flag cannot bypass the channel allowlist', () => {
  const result = preflight({ ...configured, YOUTUBE_CHANNEL_IDS: '' });
  assert.equal(result.status, 1);
  assert.match(result.output, /YOUTUBE_CHANNEL_IDS/);
});

test('disabled and non-exact enable values never authorize ingestion', () => {
  for (const value of ['', 'false', 'TRUE', ' true ', '1']) {
    const result = preflight({ ...configured, ENABLE_YOUTUBE_SYNC: value });
    assert.equal(result.status, 1);
    assert.match(result.output, /ENABLE_YOUTUBE_SYNC/);
  }
});

test('preflight reports every missing secret rather than failing on just the first', () => {
  const result = preflight({ ENABLE_YOUTUBE_SYNC: 'true', YOUTUBE_CHANNEL_IDS: channelId });
  assert.equal(result.status, 1);
  for (const name of ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.match(result.output, new RegExp(`::error::.*${name}`));
  }
});

test('invalid channel identities fail before dependency installation or network access', () => {
  for (const value of ['Hearts2Hearts Official', 'https://youtube.com/@fixture', `${channelId},`]) {
    const result = preflight({ ...configured, YOUTUBE_CHANNEL_IDS: value });
    assert.equal(result.status, 1);
    assert.match(result.output, /approved channel IDs, not names or URLs/);
    assert.ok(!result.output.includes(value));
  }
});

test('approved configuration succeeds without loading the SDK or performing an import', () => {
  const result = preflight({ ...configured, YOUTUBE_CHANNEL_IDS: `${channelId},UC${'b'.repeat(22)}` });
  assert.equal(result.status, 0);
  assert.match(result.summary, /Configuration ready/);
  assert.match(result.output, /Configuration ready/);
  for (const name of ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    assert.ok(!(result.output + result.summary).includes(configured[name]));
  }
});

test('approved preflight works in an isolated checkout with no installed SDK', () => {
  const directory = mkdtempSync(join(tmpdir(), 'youtube-preflight-no-sdk-'));
  try {
    mkdirSync(join(directory, 'scripts'), { recursive: true });
    mkdirSync(join(directory, 'src/lib'), { recursive: true });
    for (const file of ['scripts/check-youtube-sync.cjs', 'scripts/fetch-youtube.cjs', 'src/lib/videoMetadata.cjs']) {
      copyFileSync(join(root, file), join(directory, file));
    }
    const result = spawnSync(process.execPath, [join(directory, 'scripts/check-youtube-sync.cjs')], {
      cwd: directory, env: configured, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Configuration ready/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('verified thirteen-channel manifest is compatible with importer and workflow preflight', () => {
  const manifest = require('../config/youtube-channels.json');
  const { loadConfig } = require('../scripts/fetch-youtube.cjs');
  const { checkWorkflowConfig } = require('../scripts/check-youtube-sync.cjs');
  assert.ok(Number.isFinite(Date.parse(manifest.verifiedAt)));
  assert.equal(manifest.channels.length, 13);
  const ids = manifest.channels.map(channel => channel.channelId);
  assert.equal(new Set(ids).size, 13);
  assert.equal(new Set(manifest.channels.map(channel => channel.url)).size, 13);
  for (const channel of manifest.channels) {
    assert.match(channel.channelId, /^UC[A-Za-z0-9_-]{22}$/);
    const url = new URL(channel.url);
    assert.equal(url.origin, 'https://www.youtube.com');
    assert.ok(url.pathname.startsWith('/@') || url.pathname === `/channel/${channel.channelId}`);
  }
  const env = { ...configured, YOUTUBE_CHANNEL_IDS: ids.join(',') };
  assert.deepEqual(loadConfig(env, []).channelIds, ids);
  assert.deepEqual(checkWorkflowConfig(env), []);
});

test('invalid database targets are reported without echoing configuration values', () => {
  const target = 'https://fixture.supabase.co/path?private=do-not-print';
  const result = preflight({ ...configured, SUPABASE_URL: target });
  assert.equal(result.status, 1);
  assert.match(result.output, /SUPABASE_URL/);
  assert.ok(!result.output.includes(target));
});

test('the writer CLI cannot start when approval is absent or non-exact', () => {
  for (const enabled of ['', 'false', 'TRUE', ' true ', '1']) {
    const result = spawnSync(process.execPath, [join(root, 'scripts/fetch-youtube.cjs')], {
      env: { ...configured, ENABLE_YOUTUBE_SYNC: enabled }, encoding: 'utf8', timeout: 5000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ENABLE_YOUTUBE_SYNC/);
    assert.ok(!result.stdout.includes('sync-summary'));
    for (const value of Object.values(configured).filter(value => value.startsWith('private'))) {
      assert.ok(!(result.stdout + result.stderr).includes(value));
    }
  }
});

test('preflight also reports configuration errors outside GitHub Actions', () => {
  const result = spawnSync(process.execPath, [join(root, 'scripts/check-youtube-sync.cjs')], {
    env: {}, encoding: 'utf8', timeout: 5000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENABLE_YOUTUBE_SYNC/);
  assert.match(result.stderr, /YOUTUBE_CHANNEL_IDS/);
});
