import assert from 'node:assert/strict';
import test from 'node:test';
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
