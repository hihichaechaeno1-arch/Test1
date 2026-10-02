import assert from 'node:assert/strict';
import test from 'node:test';
import { mapSupabaseRowToVideoItem } from '../src/lib/videoData';

for (const url of [
  'https://www.youtube.com/watch?v=abcdefghijk',
  'https://www.youtube.com/shorts/abcdefghijk',
]) {
  test(`importer row preserves playback and thumbnail: ${url}`, () => {
    const video = mapSupabaseRowToVideoItem({
      id: 'row-1', title: 'Archive clip', url,
      thumbnail: 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg',
      channel: 'Approved channel', type: 'video', published_at: '2026-10-01',
      members: ['Carmen', 'Jiwoo'], description: 'A recorded performance',
    });
    assert.equal(video.youtubeId, 'abcdefghijk');
    assert.equal(video.thumbnailUrl, 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg');
    assert.equal(video.description, 'A recorded performance');
  });
}

test('canonical frontend fields remain supported', () => {
  const video = mapSupabaseRowToVideoItem({
    id: 'row-2', title: 'Clip', youtube_id: 'abcdefghijk',
    thumbnail_url: 'https://example.com/thumbnail.jpg',
    published_at: '2026-10-01T23:00:00Z', members: '["Carmen", "Jiwoo"]',
  });
  assert.equal(video.youtubeId, 'abcdefghijk');
  assert.equal(video.thumbnailUrl, 'https://example.com/thumbnail.jpg');
  assert.deepEqual(video.members, ['Carmen', 'Jiwoo']);
  assert.equal(video.publishedAt, '2026-10-01');
});

test('unknown and duplicate member tags are normalized, not unsafe-cast', () => {
  const video = mapSupabaseRowToVideoItem({ youtube_id: 'abcdefghijk', members: [' carmen ', 'Carmen', 'jiwoo', '', 'Unknown', null] });
  assert.deepEqual(video.members, ['Carmen', 'Jiwoo']);
});

test('missing metadata stays unknown and identity remains stable', () => {
  const video = mapSupabaseRowToVideoItem({ url: 'https://youtu.be/abcdefghijk', title: { bad: true }, description: 42 });
  assert.equal(video.id, 'abcdefghijk');
  assert.equal(video.publishedAt, '');
  assert.equal(video.category, 'all');
  assert.equal(video.description, '');
  assert.equal(video.duration, '未提供');
});

test('malformed rows, playback hosts, and impossible dates are rejected', () => {
  for (const row of [null, [], { url: 'https://evil.example/watch?v=abcdefghijk' },
    { youtube_id: 'abcdefghijk', published_at: '2026-02-30' },
    { youtube_id: 'abcdefghijk', published_at: '2026-10-01Tinvalid' },
    { youtube_id: 'abcdefghijk', members: '[broken]' },
    { youtube_id: 'abcdefghijk', type: 'invalid' }]) {
    assert.throws(() => mapSupabaseRowToVideoItem(row));
  }
});
