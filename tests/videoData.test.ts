import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterVideosByMembers,
  mapSupabaseRowToVideoItem,
  getVideoGroup,
  parseViewsCount,
  sortVideoItems,
  classifyVideoGenre,
} from '../src/lib/videoData';
import type { VideoItem } from '../src/types';

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

test('videos are classified into 4 distinct groups: official, shorts, stage, and others', () => {
  // 1. Official Hearts2Hearts channel long-form videos (MV, official variety shows, dance practice, vlogs)
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts 官方頻道', type: 'video', title: '【MV】Heart Beat Echo' }), 'official');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts 官方頻道', type: 'video', title: '【團綜】H2H 宿舍大解密 EP.01' }), 'official');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'Dance Practice' }), 'official');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'Hearts2Hearts 하츠투하츠 \'Moonride\' MV' }), 'official');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'ICONIC POWER RACE | 둘셋하투하 EP.4' }), 'official');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'Hearts2Hearts \'15-LOVE\' Dance Practice BH2ND' }), 'official');
  assert.equal(getVideoGroup({ channel: 'H2H 官方', type: 'video', title: '琴房隨筆 VLOG' }), 'official');

  // 2. Official Shorts (Shorts specifically from the official Hearts2Hearts channel, including real challenge titles without literal #shorts word)
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts 官方頻道', type: 'shorts', title: '舞蹈手勢挑戰' }), 'shorts');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: '打歌後台 #shorts' }), 'shorts');
  assert.equal(getVideoGroup({ channel: 'H2H 官方頻道', type: 'shorts', title: '【Shorts】隊長反差萌' }), 'shorts');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'different #Hearts2Hearts #하츠투하츠 #H2H #JIWOO #JUUN' }), 'shorts');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'like if I can\'t help falling in love with you? #Hearts2Hearts #H2H #CARMEN #STELLA' }), 'shorts');
  assert.equal(getVideoGroup({ channel: 'Hearts2Hearts', type: 'video', title: 'one two check #Hearts2Hearts #H2H #A_NA #IAN' }), 'shorts');

  // 3. Stage & Fancam (Music shows, broadcast stages, fancams, relay dance)
  assert.equal(getVideoGroup({ channel: 'SBSKPOP X INKIGAYO', type: 'video', title: 'Heart Beat Echo 現場舞台' }), 'stage');
  assert.equal(getVideoGroup({ channel: 'SBSKPOP', type: 'shorts', title: 'Inkigayo Fancam Short' }), 'stage');
  assert.equal(getVideoGroup({ channel: 'Mnet K-POP', type: 'video', title: 'Carmen 4K 個人直拍 Fancam' }), 'stage');
  assert.equal(getVideoGroup({ channel: 'STUDIO CHOOM', type: 'video', title: 'BE ORIGINAL 合作舞台' }), 'stage');
  assert.equal(getVideoGroup({ channel: 'it\'s Live', type: 'video', title: '樂團生唱現場' }), 'stage');
  assert.equal(getVideoGroup({ channel: 'M2', type: 'video', title: 'Jiwoo 接力舞 Relay Dance #shorts' }), 'stage');

  // 4. Others (External variety shows, interviews, external shorts, etc.)
  assert.equal(getVideoGroup({ channel: '아는형님 Knowingbros', type: 'video', title: '轉學生 Hearts2Hearts 爆笑個人技' }), 'others');
  assert.equal(getVideoGroup({ channel: '런닝맨 - 스브스 공식 채널', type: 'video', title: 'Running Man 搶鈴遊戲' }), 'others');
  assert.equal(getVideoGroup({ channel: 'JTBC Entertainment', type: 'video', title: 'Idol Room 偶像大訪談' }), 'others');
  assert.equal(getVideoGroup({ channel: '1theK', type: 'shorts', title: '【Shorts】Stella 表情切換挑戰' }), 'others');
  assert.equal(getVideoGroup({ channel: 'K-POP ON! Spotify', type: 'shorts', title: '隨機舞蹈挑戰 #shorts' }), 'others');
});

test('parseViewsCount extracts numeric counts accurately across varied formats', () => {
  assert.equal(parseViewsCount('2,480,000 次觀看'), 2480000);
  assert.equal(parseViewsCount('840,000 次觀看'), 840000);
  assert.equal(parseViewsCount('3,890,000 次觀看'), 3890000);
  assert.equal(parseViewsCount('1.5M'), 1500000);
  assert.equal(parseViewsCount('500K'), 500000);
  assert.equal(parseViewsCount('12,345'), 12345);
  assert.equal(parseViewsCount(100000), 100000);
  assert.equal(parseViewsCount(''), 0);
  assert.equal(parseViewsCount(null), 0);
});

test('sortVideoItems correctly orders videos by new, old, and popular', () => {
  const v1: VideoItem = {
    id: 'v1', title: 'Early clip', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen'], duration: '3:00', publishedAt: '2026-01-10', views: '5,000,000 次觀看',
    thumbnailUrl: 'https://example.com/1.jpg', youtubeId: 'aaaaaaaaaaa', description: '',
  };
  const v2: VideoItem = {
    id: 'v2', title: 'Mid clip', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen'], duration: '3:00', publishedAt: '2026-02-15', views: '1,000,000 次觀看',
    thumbnailUrl: 'https://example.com/2.jpg', youtubeId: 'bbbbbbbbbbb', description: '',
  };
  const v3: VideoItem = {
    id: 'v3', title: 'Latest clip', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen'], duration: '3:00', publishedAt: '2026-03-20', views: '2,500,000 次觀看',
    thumbnailUrl: 'https://example.com/3.jpg', youtubeId: 'ccccccccccc', description: '',
  };

  const sample = [v2, v1, v3];

  // 1. Newest first (new)
  const sortedNew = sortVideoItems(sample, 'new');
  assert.deepEqual(sortedNew.map((v) => v.id), ['v3', 'v2', 'v1']);

  // 2. Oldest first (old)
  const sortedOld = sortVideoItems(sample, 'old');
  assert.deepEqual(sortedOld.map((v) => v.id), ['v1', 'v2', 'v3']);

  // 3. Most popular first (popular)
  const sortedPopular = sortVideoItems(sample, 'popular');
  assert.deepEqual(sortedPopular.map((v) => v.id), ['v1', 'v3', 'v2']);
});

test('filterVideosByMembers correctly handles "including" and "only" modes', () => {
  const soloCarmen: VideoItem = {
    id: 'solo-carmen', title: 'Carmen Solo', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen'], duration: '3:00', publishedAt: '2026-01-01', views: '100',
    thumbnailUrl: 'https://example.com/c.jpg', youtubeId: '11111111111', description: '',
  };
  const duoCarmenStella: VideoItem = {
    id: 'duo-carmen-stella', title: 'Carmen & Stella Duo', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen', 'Stella'], duration: '3:00', publishedAt: '2026-01-02', views: '200',
    thumbnailUrl: 'https://example.com/cs.jpg', youtubeId: '22222222222', description: '',
  };
  const trioCarmenStellaJiwoo: VideoItem = {
    id: 'trio-3', title: 'Carmen, Stella & Jiwoo', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen', 'Stella', 'Jiwoo'], duration: '3:00', publishedAt: '2026-01-03', views: '300',
    thumbnailUrl: 'https://example.com/csj.jpg', youtubeId: '33333333333', description: '',
  };
  const groupAll: VideoItem = {
    id: 'group-all', title: 'Full Group', type: 'video', category: 'all', channel: 'Ch',
    members: ['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'], duration: '3:00', publishedAt: '2026-01-04', views: '400',
    thumbnailUrl: 'https://example.com/all.jpg', youtubeId: '44444444444', description: '',
  };

  const pool = [soloCarmen, duoCarmenStella, trioCarmenStellaJiwoo, groupAll];

  // 1. Single member: 'Carmen'
  // - including: matches all 4 (all contain Carmen)
  const incCarmen = filterVideosByMembers(pool, ['Carmen'], 'including');
  assert.deepEqual(incCarmen.map((v) => v.id), ['solo-carmen', 'duo-carmen-stella', 'trio-3', 'group-all']);

  // - only: matches ONLY soloCarmen (members is strictly ['Carmen'])
  const onlyCarmen = filterVideosByMembers(pool, ['Carmen'], 'only');
  assert.deepEqual(onlyCarmen.map((v) => v.id), ['solo-carmen']);

  // 2. Two members: 'Carmen' + 'Stella'
  // - including: matches duo, trio, and group (all contain both Carmen and Stella)
  const incDuo = filterVideosByMembers(pool, ['Carmen', 'Stella'], 'including');
  assert.deepEqual(incDuo.map((v) => v.id), ['duo-carmen-stella', 'trio-3', 'group-all']);

  // - only: matches ONLY duo-carmen-stella (strictly Carmen & Stella, excludes trio and full group)
  const onlyDuo = filterVideosByMembers(pool, ['Carmen', 'Stella'], 'only');
  assert.deepEqual(onlyDuo.map((v) => v.id), ['duo-carmen-stella']);

  // 3. Empty selection returns all videos (shows all videos when no member is selected)
  assert.deepEqual(filterVideosByMembers(pool, [], 'including'), pool);
  assert.deepEqual(filterVideosByMembers(pool, [], 'only'), pool);
});

test('classifyVideoGenre accurately categorizes into 5 distinct types', () => {
  // 1. Official Music Videos (MVs)
  assert.equal(classifyVideoGenre("Hearts2Hearts 하츠투하츠 'Next Chapter' MV", '', 'Hearts2Hearts'), 'mv');
  assert.equal(classifyVideoGenre("【MV】Heart Beat Echo", '', 'Hearts2Hearts 官方頻道'), 'mv');
  assert.equal(classifyVideoGenre("Hearts2Hearts 하츠투하츠 'Moonride' Music Video", '', 'SMTOWN'), 'mv');

  // 2. Shorts & Challenges
  assert.equal(classifyVideoGenre('that one hotpot night.. #Hearts2Hearts #하츠투하츠 #H2H', '', 'Hearts2Hearts'), 'shorts');
  assert.equal(classifyVideoGenre('STYLE 手勢舞挑戰', '', 'Hearts2Hearts'), 'shorts');
  assert.equal(classifyVideoGenre('Cute moment', '', 'Hearts2Hearts', 'https://youtube.com/shorts/abcdefghijk'), 'shorts');

  // 3. Stage Performances (Music shows + Concerts + Special stages)
  assert.equal(classifyVideoGenre('[#음중직캠] Hearts2Hearts STELLA – STYLE FanCam | 쇼! 음악중심', '', 'MBCkpop'), 'stage');
  assert.equal(classifyVideoGenre('ICONIC HEART - Hearts2Hearts [뮤직뱅크/Music Bank]', '', 'KBS Kpop'), 'stage');
  assert.equal(classifyVideoGenre('Hearts2Hearts - INTRO + Lemon Tang #2026SBS가요대전Summer', '', 'SBS Entertainment'), 'stage');

  // 4. Original Content (Vlogs, reality series, self-produced content)
  assert.equal(classifyVideoGenre('ICONIC POWER RACE | 둘셋하투하 EP.4', '', 'Hearts2Hearts'), 'original');
  assert.equal(classifyVideoGenre('琴房隨筆 VLOG EP.01', '', 'Hearts2Hearts'), 'original');
  assert.equal(classifyVideoGenre('轉學生 Hearts2Hearts | 아는 형님 520회', '', '아는형님 Knowingbros'), 'original');

  // 5. Other Official / Semi-official Content (Behind-the-scenes, interviews, covers, lyric videos, teasers)
  assert.equal(classifyVideoGenre("[Teaser] Hearts2Hearts 'Next Chapter' MV Teaser #1", '', 'Hearts2Hearts'), 'other');
  assert.equal(classifyVideoGenre("Promotion Event in Japan BH2ND #1 (Behind)", '', 'Hearts2Hearts'), 'other');
  assert.equal(classifyVideoGenre("Hearts2Hearts Album Unboxing & Interview", '', 'Hearts2Hearts'), 'other');
});


