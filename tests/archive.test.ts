import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { fetchArchiveVideos } from '../src/lib/archive';

const row = (id: number) => ({ id, title: `Clip ${id}`, url: 'https://www.youtube.com/watch?v=abcdefghijk', published_at: '2026-10-01', members: ['Carmen'] });

// A fake external Data API intentionally enforces a cap smaller than the requested page size.
function database(rows: unknown[]) {
  return { from: () => ({
    select: (columns: string) => {
      assert.ok(!columns.includes('*'), 'private columns must not be requested');
      const query = {
        order: () => query,
        range: (start: number) => ({ abortSignal: async () => ({ data: rows.slice(start, start + 2), error: null, count: rows.length }) }),
      };
      return query;
    },
  }) };
}

test('records beyond a smaller server page cap remain discoverable', async () => {
  const videos = await fetchArchiveVideos(database([row(1), row(2), row(3)]) as any);
  assert.deepEqual(videos.map(video => video.id), ['1', '2', '3']);
});

test('empty live archive stays empty instead of displaying invented content', async () => {
  assert.deepEqual(await fetchArchiveVideos(database([]) as any), []);
});

test('database failures do not yield a partial archive or silent sample fallback', async () => {
  const query = {
    select: () => query, order: () => query, range: () => query,
    abortSignal: async () => ({ data: null, error: { message: 'private detail' }, count: null }),
  };
  await assert.rejects(fetchArchiveVideos({ from: () => query } as any), /無法讀取/);
});

test('an aborted fetch cannot publish stale results', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchArchiveVideos(database([row(1)]) as any, controller.signal));
});

// Exercise the real Supabase SDK query and error boundary, not a second reader implementation.
function dataApi(handler: (url: URL) => Response) {
  const requests: URL[] = [];
  const client = createClient('https://fixture.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      assert.ok(!url.searchParams.get('select')?.includes('*'), 'never expose private columns');
      return handler(url);
    } },
  });
  return { client, requests };
}

const missingDescription = () => Response.json({
  code: '42703', message: 'column videos.description does not exist', details: null, hint: null,
}, { status: 400 });

function page(url: URL, rows: unknown[]) {
  const start = Number(url.searchParams.get('offset') || 0);
  const data = rows.slice(start, start + 2);
  return Response.json(data, { headers: { 'content-range': `${start}-${start + data.length - 1}/${rows.length}` } });
}

for (const format of ['legacy', 'canonical'] as const) {
  test(`${format} tables without optional description still load all valid live rows`, async () => {
    const rows = [row(1), row(2), row(3)].map(value => format === 'legacy' ? value : {
      ...value, youtube_id: 'abcdefghijk', thumbnail_url: 'https://example.com/thumbnail.jpg',
    });
    const api = dataApi(url => url.searchParams.get('select')?.split(',').includes('description')
      ? missingDescription() : page(url, rows));
    const videos = await fetchArchiveVideos(api.client, undefined, format);
    assert.deepEqual(videos.map(video => video.id), ['1', '2', '3']);
    assert.ok(videos.every(video => video.description === '' && !video.isSample));
    assert.equal(api.requests.length, 3, 'one compatibility retry, then normal pagination');
    assert.match(api.requests[0].searchParams.get('select')!, /,description$/);
    const expected = format === 'legacy'
      ? 'id,title,url,thumbnail,channel,type,published_at,members'
      : 'id,title,youtube_id,thumbnail_url,channel,type,published_at,members';
    for (const request of api.requests.slice(1)) {
      assert.equal(request.searchParams.get('select'), expected);
      assert.equal(request.searchParams.get('order'), 'published_at.desc.nullslast,id.asc');
    }
    assert.equal(api.requests[1].searchParams.get('offset'), '0');
    assert.equal(api.requests[2].searchParams.get('offset'), '2');
  });
}

test('missing response counts still advance to an empty page without losing records', async () => {
  const rows = [row(1), row(2), row(3)];
  const api = dataApi(url => {
    const start = Number(url.searchParams.get('offset') || 0);
    return Response.json(rows.slice(start, start + 2));
  });
  assert.deepEqual((await fetchArchiveVideos(api.client)).map(video => video.id), ['1', '2', '3']);
  assert.deepEqual(api.requests.map(url => Number(url.searchParams.get('offset'))), [0, 2, 3]);
});

test('a response arriving after cancellation cannot publish results', async () => {
  const controller = new AbortController();
  const api = dataApi(url => {
    controller.abort();
    return page(url, [row(1)]);
  });
  await assert.rejects(fetchArchiveVideos(api.client, controller.signal), /取消|逾時/);
});

test('available descriptions are retained without a compatibility retry', async () => {
  const api = dataApi(url => page(url, [{ ...row(1), description: 'Jiwoo rehearsal' }]));
  const videos = await fetchArchiveVideos(api.client);
  assert.equal(videos[0].description, 'Jiwoo rehearsal');
  assert.equal(api.requests.length, 1);
});

test('missing required columns, permission errors, and auth errors never trigger schema fallback', async () => {
  for (const error of [
    { code: '42703', message: 'column videos.url does not exist' },
    { code: '42501', message: 'permission denied for description' },
    { code: 'PGRST301', message: 'private authentication detail' },
    { code: '42703', message: 'private unrecognized schema detail' },
  ]) {
    const api = dataApi(() => Response.json(error, { status: 400 }));
    await assert.rejects(fetchArchiveVideos(api.client), error => {
      assert.match(String(error), /無法讀取/);
      assert.ok(!String(error).includes('private'));
      return true;
    });
    assert.equal(api.requests.length, 1);
  }
});

test('a failed compatibility query stops rather than repeating or showing samples', async () => {
  const api = dataApi(url => url.searchParams.get('select')?.split(',').includes('description')
    ? missingDescription() : Response.json({ code: '42501', message: 'private policy detail' }, { status: 403 }));
  await assert.rejects(fetchArchiveVideos(api.client), /無法讀取/);
  assert.equal(api.requests.length, 2);
});

test('missing description after rows were already loaded rejects an inconsistent partial archive', async () => {
  const api = dataApi(url => Number(url.searchParams.get('offset')) > 0
    ? missingDescription() : page(url, [row(1), row(2), row(3)]));
  await assert.rejects(fetchArchiveVideos(api.client), /無法讀取/);
  assert.equal(api.requests.length, 2, 'compatibility applies only before any rows are loaded');
});

test('malformed live rows remain errors even when description is optional', async () => {
  const api = dataApi(url => url.searchParams.get('select')?.split(',').includes('description')
    ? missingDescription() : page(url, [row(1), { ...row(2), url: 'https://evil.example/watch?v=abcdefghijk' }]));
  await assert.rejects(fetchArchiveVideos(api.client), /YouTube identity/);
  assert.equal(api.requests.length, 2);
});
