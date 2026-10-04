import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { detectMembers, loadConfig, syncVideos } = require('../scripts/fetch-youtube.cjs');

const item = (title = 'Hearts2Hearts Carmen #shorts') => ({
  id: { videoId: 'abcdefghijk' },
  snippet: { channelId: `UC${'a'.repeat(22)}`, channelTitle: 'Approved channel', title,
    description: 'Jiwoo rehearsal', publishedAt: '2026-10-01T00:00:00Z' },
});

function fakeDatabase({ existing = null, winner = null, lookupError = null, writeError = null }: any = {}) {
  const records: any[] = [];
  const client = { from: () => ({
    select: () => ({
      in: () => ({ maybeSingle: async () => ({ data: existing, error: lookupError }) }),
      eq: () => ({ maybeSingle: async () => ({ data: winner || existing, error: lookupError }) }),
    }),
    insert: async (record: any) => { records.push(record); return { error: writeError }; },
    update: (record: any) => ({ eq: async () => { records.push(record); return { error: writeError, count: writeError ? 0 : 1 }; } }),
  }) };
  return { client, records };
}

test('unknown text does not claim a full-group appearance', () => {
  assert.deepEqual(detectMembers('unlabeled performance'), []);
});

test('incidental English and Korean substrings do not tag members', () => {
  assert.deepEqual(detectMembers('piano solo, banana, 준비'), []);
});

test('explicit names and hashtags produce inferred tags', () => {
  assert.deepEqual(detectMembers('#Carmen with JIWOO and #예온'), ['Carmen', 'Jiwoo', 'Ye-on']);
});

const channelId = `UC${'a'.repeat(22)}`;
const env = {
  YOUTUBE_API_KEY: 'test-key', SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key', YOUTUBE_CHANNEL_IDS: channelId,
};

test('importing requires an explicit channel allowlist, never a title search', () => {
  assert.throws(() => loadConfig({ ...env, YOUTUBE_CHANNEL_IDS: '' }), /YOUTUBE_CHANNEL_IDS/);
  assert.deepEqual(loadConfig(env).channelIds, [channelId]);
});

test('a same-name channel outside the allowlist is never written', async () => {
  const result = await syncVideos({
    ...loadConfig(env), client: { from: () => { throw new Error('Unexpected database write'); } },
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [{
      id: { videoId: 'abcdefghijk' },
      snippet: { channelId: `UC${'b'.repeat(22)}`, channelTitle: 'Hearts2Hearts Official', title: 'Carmen' },
    }] }) }), log: () => {},
  });
  assert.equal(result.inserted, 0);
  assert.equal(result.skipped, 1);
});

test('lookup errors are reported without attempting an insert', async () => {
  const db = fakeDatabase({ lookupError: { message: 'private database detail' } });
  const logs: unknown[] = [];
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: (entry: unknown) => logs.push(entry),
  });
  assert.equal(result.failed, 1);
  assert.deepEqual(db.records, []);
  assert.match(JSON.stringify(logs), /database-failed/);
  assert.ok(!JSON.stringify(logs).includes('private database detail'));
});

test('insert failures and all-channel API failures cannot report success', async () => {
  const db = fakeDatabase({ writeError: { message: 'private error' } });
  const insertion = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(insertion.failed, 1);
  assert.equal(insertion.inserted, 0);
  const api = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: false, status: 403 }), log: () => {},
  });
  assert.equal(api.failed, 1);
  assert.equal(api.channels[0].complete, false);
});

test('new Shorts use canonical identity and retain description and inferred tags', async () => {
  const db = fakeDatabase();
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.inserted, 1);
  assert.equal(db.records[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(db.records[0].type, 'shorts');
  assert.equal(db.records[0].description, 'Jiwoo rehearsal');
  assert.deepEqual(db.records[0].members, ['Carmen', 'Jiwoo']);
  assert.deepEqual(result.metadataOmissions, []);
});

test('source refresh preserves existing editorial member tags', async () => {
  const db = fakeDatabase({ existing: { id: 'existing-1' } });
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.updated, 1);
  assert.ok(!('members' in db.records[0]));
});

test('bounded scans report a continuation token instead of claiming full history', async () => {
  const result = await syncVideos({ ...loadConfig(env), client: fakeDatabase().client, maxPages: 1,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [], nextPageToken: 'next-page' }) }), log: () => {},
  });
  assert.equal(result.channels[0].complete, false);
  assert.equal(result.channels[0].nextPageToken, 'next-page');
});

test('retry attempts remain inside the run-wide quota budget', async () => {
  const result = await syncVideos({ ...loadConfig(env), client: fakeDatabase().client, maxRequests: 1,
    fetchImpl: async () => ({ ok: false, status: 503 }), sleep: async () => {}, log: () => {},
  });
  assert.equal(result.requests, 1);
  assert.equal(result.failed, 1);
});

test('a confirmed unique-URL race is skipped, but an unrelated conflict fails', async () => {
  for (const winner of [{ id: 'winner' }, null]) {
    const db = fakeDatabase({ writeError: { code: '23505' }, winner });
    const result = await syncVideos({ ...loadConfig(env), client: db.client,
      fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
    });
    assert.equal(result.failed, winner ? 0 : 1);
    assert.equal(result.skipped, winner ? 1 : 0);
  }
});

test('source refresh works through the installed Supabase SDK HTTP boundary', async () => {
  const { createClient } = require('@supabase/supabase-js');
  const stored = { id: 'sdk-row', url: 'https://www.youtube.com/shorts/abcdefghijk', members: ['Ye-on'], title: 'Old title' };
  const client = createClient('https://fixture.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        Object.assign(stored, JSON.parse(String(init.body)));
        return new Response(null, { status: 204, headers: { 'content-range': '*/1' } });
      }
      return Response.json([stored]);
    } },
  });
  const result = await syncVideos({ ...loadConfig(env), client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.updated, 1);
  assert.equal(result.failed, 0);
  assert.equal(stored.url, 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.deepEqual(stored.members, ['Ye-on']);
});

function legacySdkDatabase({ existing = false, fallbackError = null, missingColumn = 'description',
  missingCode = 'PGRST204', affectedCount = 1 }: any = {}) {
  const { createClient } = require('@supabase/supabase-js');
  const writes: any[] = [];
  const client = createClient('https://fixture.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (_url: string, init: RequestInit) => {
      if (init.method === 'POST' || init.method === 'PATCH') {
        const payload = JSON.parse(String(init.body));
        writes.push({ method: init.method, payload });
        if (missingColumn in payload) {
          const message = missingCode === 'PGRST204'
            ? `Could not find the '${missingColumn}' column of 'videos' in the schema cache`
            : `column "${missingColumn}" of relation "videos" does not exist`;
          return Response.json({ code: missingCode, message }, { status: 400 });
        }
        if (fallbackError) return Response.json(fallbackError, { status: 403 });
        return new Response(null, { status: init.method === 'POST' ? 201 : 204,
          headers: { 'content-range': `*/${affectedCount}` } });
      }
      const found = typeof existing === 'function' ? existing(new URL(_url)) : existing;
      return Response.json(found ? [{ id: 'legacy-row', members: ['Ye-on'] }] : []);
    } },
  });
  return { client, writes };
}

for (const existing of [false, true]) {
  test(`legacy ${existing ? 'updates' : 'inserts'} retry only the absent optional description column`, async () => {
    const db = legacySdkDatabase({ existing, missingCode: existing ? '42703' : 'PGRST204' });
    const logs: any[] = [];
    const second = { ...item(), id: { videoId: 'bcdefghijkl' } };
    const result = await syncVideos({ ...loadConfig(env), client: db.client,
      fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item(), second] }) }),
      log: (entry: unknown) => logs.push(entry),
    });
    assert.equal(result.failed, 0);
    assert.equal(result[existing ? 'updated' : 'inserted'], 2);
    assert.deepEqual(result.metadataOmissions, ['description']);
    assert.equal(db.writes.length, 3, 'one failed schema write, one retry, then one compatible write');
    assert.equal(db.writes[0].payload.description, 'Jiwoo rehearsal');
    for (const write of db.writes.slice(1)) {
      assert.ok(!('description' in write.payload));
      assert.ok(write.payload.url.startsWith('https://www.youtube.com/watch?v='));
      assert.equal(write.payload.title, item().snippet.title);
      if (existing) assert.ok(!('members' in write.payload), 'preserve editorial tags');
      else assert.deepEqual(write.payload.members, ['Carmen', 'Jiwoo'], 'still infer using source description');
    }
    assert.equal(logs.filter(entry => entry.event === 'schema-compatibility').length, 1);
    assert.ok(!JSON.stringify(logs).includes('schema cache'), 'never log raw database messages');
  });
}

test('legacy description retry failure remains a failure with sanitized error-code diagnostics', async () => {
  const db = legacySdkDatabase({ fallbackError: { code: '42501', message: 'private permission detail' } });
  const logs: any[] = [];
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }),
    log: (entry: unknown) => logs.push(entry),
  });
  assert.equal(result.failed, 1);
  assert.equal(result.inserted, 0);
  assert.equal(db.writes.length, 2);
  assert.equal(logs.find(entry => entry.event === 'database-failed')?.code, '42501');
  assert.ok(!JSON.stringify(logs).includes('private permission detail'));
});

test('missing required write columns never trigger an optional-description retry', async () => {
  const db = legacySdkDatabase({ missingColumn: 'title' });
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.failed, 1);
  assert.equal(result.inserted, 0);
  assert.equal(db.writes.length, 1);
});

test('permission errors mentioning description are not mistaken for a missing column', async () => {
  const db = fakeDatabase({ writeError: { code: '42501', message: 'column "description" of relation "videos" does not exist' } });
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.failed, 1);
  assert.equal(db.records.length, 1);
});

test('a compatible update affecting zero rows cannot report success', async () => {
  const db = legacySdkDatabase({ existing: true, affectedCount: 0 });
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }), log: () => {},
  });
  assert.equal(result.failed, 1);
  assert.equal(result.updated, 0);
  assert.equal(db.writes.length, 2);
});

test('unrecognized database error codes and messages never leak into logs', async () => {
  const db = fakeDatabase({ lookupError: { code: 'private-credential-fixture', message: 'private detail' } });
  const logs: any[] = [];
  const result = await syncVideos({ ...loadConfig(env), client: db.client,
    fetchImpl: async () => ({ ok: true, json: async () => ({ items: [item()] }) }),
    log: (entry: unknown) => logs.push(entry),
  });
  assert.equal(result.failed, 1);
  assert.equal(logs.find(entry => entry.event === 'database-failed')?.code, 'unknown');
  assert.ok(!JSON.stringify(logs).includes('private'));
  assert.deepEqual(db.records, []);
});

test('the 850-write/305-skip incident pattern succeeds through bounded paginated legacy ingestion', async () => {
  const accepted = Array.from({ length: 850 }, (_, index) => ({
    ...item(), id: { videoId: String(index).padStart(11, '0') },
  }));
  const existingIds = accepted.slice(0, 3).map(video => video.id.videoId);
  const db = legacySdkDatabase({ existing: (url: URL) =>
    existingIds.some(id => url.searchParams.get('url')?.includes(id)) });
  const rejected = Array.from({ length: 305 }, () => ({
    ...item('Unrelated archive clip'), snippet: { ...item('Unrelated archive clip').snippet, description: '' },
  }));
  const allItems = [...accepted, ...rejected];
  const logs: any[] = [];
  const result = await syncVideos({ ...loadConfig(env), client: db.client, maxPages: 24,
    fetchImpl: async (input: string) => {
      const offset = Number(new URL(input).searchParams.get('pageToken') || 0);
      return { ok: true, json: async () => ({ items: allItems.slice(offset, offset + 50),
        ...(offset + 50 < allItems.length ? { nextPageToken: String(offset + 50) } : {}),
      }) };
    }, log: (entry: unknown) => logs.push(entry),
  });
  assert.equal(result.inserted, 847);
  assert.equal(result.updated, 3);
  assert.equal(result.skipped, 305);
  assert.equal(result.failed, 0);
  assert.equal(result.requests, 24);
  assert.equal(result.channels[0].complete, true);
  assert.equal(db.writes.length, 851, '850 successful writes plus one rejected optional-column statement');
  assert.deepEqual(result.metadataOmissions, ['description']);
  assert.equal(logs.filter(entry => entry.event === 'schema-compatibility').length, 1);
});

test('backfill requires an explicit date window and a single channel for token resume', () => {
  assert.throws(() => loadConfig(env, ['--mode=backfill']), /published-before/);
  assert.throws(() => loadConfig({ ...env, YOUTUBE_CHANNEL_IDS: `${channelId},UC${'b'.repeat(22)}` }, ['--page-token=next']), /exactly one/);
  assert.equal(loadConfig(env, ['--mode=backfill', '--published-before=2026-10-01T00:00:00Z']).mode, 'backfill');
});
