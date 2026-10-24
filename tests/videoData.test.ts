import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterVideosByMembers,
  mapSupabaseRowToVideoItem,
  getVideoGroup,
  getVideoGroups,
  parseViewsCount,
  sortVideoItems,
  classifyVideoGenre,
  classifyVideoGenres,
  FIVE_CATEGORIES,
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

test('stored tags and explicit unknown membership survive title and description guesses', () => {
  const row = { youtube_id: 'abcdefghijk', title: 'Carmen performance', description: 'Stella and Ian' };
  assert.deepEqual(mapSupabaseRowToVideoItem({ ...row, members: ['Jiwoo', 'Yuha'] }).members, ['Jiwoo', 'Yuha']);
  assert.deepEqual(mapSupabaseRowToVideoItem({ ...row, members: [] }).members, []);
  assert.deepEqual(mapSupabaseRowToVideoItem(row).members, []);
  assert.deepEqual(mapSupabaseRowToVideoItem({ ...row, members: ['constructor', '__proto__', 'toString'] }).members, []);
  assert.deepEqual(mapSupabaseRowToVideoItem({ ...row, members: 'a_na,에이나,ye_on' }).members, ['A-na', 'Ye-on']);
});

test('YouTube identities require exact supported hosts and complete IDs', () => {
  for (const url of ['https://notyoutube.com/watch?v=abcdefghijk', 'https://youtube.com.evil.example/watch?v=abcdefghijk',
    'https://youtube.com/shorts/abcdefghijkl', 'javascript:abcdefghijk']) {
    assert.throws(() => mapSupabaseRowToVideoItem({ url }), /YouTube identity/);
  }
  for (const url of ['https://youtube.com/watch?list=fixture&v=abcdefghijk', 'https://youtube.com/live/abcdefghijk']) {
    assert.equal(mapSupabaseRowToVideoItem({ url }).youtubeId, 'abcdefghijk');
  }
  const mapped = mapSupabaseRowToVideoItem({ id: 0, youtube_id: 'abcdefghijk', thumbnail: 'javascript:bad' });
  assert.equal(mapped.id, '0');
  assert.equal(mapped.channel, '未提供頻道名稱');
  assert.equal(mapped.views, '');
  assert.equal(mapped.thumbnailUrl, 'https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg');
});

test('legacy genre values normalize without conflating format and category', () => {
  for (const type of ['mv', 'stage', 'original', 'other']) {
    const mapped = mapSupabaseRowToVideoItem({ youtube_id: 'abcdefghijk', title: 'Clip', type });
    assert.equal(mapped.type, 'video');
    assert.equal(mapped.genre, type);
  }
});

test('five content categories: Shorts tab is official-channel only', () => {
  const cases = [
    [{ channel: 'Hearts2Hearts', type: 'video', title: '【MV】Heart Beat Echo' }, 'mv'],
    [{ channel: 'Hearts2Hearts', title: '團綜 EP.01' }, 'original'],
    [{ channel: 'Hearts2Hearts', title: 'Dance Practice' }, 'stage'],
    [{ channel: 'Hearts2Hearts', title: 'Dance Practice BH2ND (Behind)' }, 'other'],
    [{ channel: 'Hearts2Hearts', type: 'shorts', title: 'Cute moment' }, 'shorts'],
    [{ channel: '1theK', type: 'shorts', title: 'Stella challenge' }, 'other'],
    [{ channel: 'M2', title: 'Relay Dance #shorts' }, 'stage'],
    [{ channel: 'M2', type: 'shorts', title: 'Juun & A-na Cypher 幕後練習' }, 'other'],
    [{ channel: 'Mnet K-POP', title: 'Carmen 4K Fancam' }, 'stage'],
    [{ channel: 'SBS Entertainment', title: 'Interview (Behind)' }, 'other'],
    [{ channel: '아는형님 Knowingbros', title: 'Hearts2Hearts 방문' }, 'original'],
    [{ channel: 'Hearts2Hearts', title: 'different #Hearts2Hearts #JIWOO' }, 'other'],
    [{ channel: 'Unofficial Hearts2Hearts Fan', title: 'Unlabeled clip' }, 'other'],
    [{ channel: 'M2', title: '【SOLO】Juun 錄音室自作 Rap Cypher' }, 'other'],
  ] as const;
  for (const [video, expected] of cases) assert.equal(getVideoGroup(video), expected);
});

test('official vlog Shorts appear in both Shorts and 官方綜藝/物料', () => {
  assert.deepEqual(
    getVideoGroups({
      channel: 'Hearts2Hearts 官方頻道',
      type: 'shorts',
      title: '【Shorts】Yuha 琴房隨筆！15秒即興',
    }),
    ['shorts', 'original'],
  );
  assert.deepEqual(
    classifyVideoGenres('【Shorts】Ian 後台待機室的探險日記', '', 'Hearts2Hearts', '', 'shorts'),
    ['shorts', 'original'],
  );
  assert.deepEqual(
    classifyVideoGenres('Carmen 錄音室自彈自唱 30秒', '', 'Hearts2Hearts', '', 'shorts'),
    ['shorts'],
  );
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
  assert.equal(parseViewsCount('1.2萬'), 12000);
  assert.equal(parseViewsCount('1億'), 100000000);
  assert.equal(parseViewsCount('Hearts2Hearts'), 0);
  assert.equal(parseViewsCount('1.2.3M'), 0);
  assert.equal(parseViewsCount(Infinity), 0);
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

test('unknown publication dates sort last without treating the Unix epoch as unknown', () => {
  const base = mapSupabaseRowToVideoItem({ youtube_id: 'abcdefghijk' });
  const records = [{ ...base, id: 'a-unknown' }, { ...base, id: 'z-epoch', publishedAt: '1970-01-01' },
    { ...base, id: 'recent', publishedAt: '2026-01-01' }];
  assert.deepEqual(sortVideoItems(records, 'old').map(video => video.id), ['z-epoch', 'recent', 'a-unknown']);
  assert.deepEqual(sortVideoItems(records, 'new').map(video => video.id), ['recent', 'z-epoch', 'a-unknown']);
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

  const untagged: VideoItem = { ...soloCarmen, id: 'untagged', members: [], youtubeId: '55555555555' };
  const jiwooIan: VideoItem = {
    ...duoCarmenStella, id: 'jiwoo-ian', members: ['Ian', 'Jiwoo'], youtubeId: '66666666666',
  };
  const withUntagged = [...pool, untagged, jiwooIan];

  assert.deepEqual(filterVideosByMembers(withUntagged, ['Jiwoo', 'Ian'], 'including').map(v => v.id), ['group-all', 'jiwoo-ian']);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Jiwoo', 'Ian'], 'only').map(v => v.id), ['jiwoo-ian']);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Ian', 'Jiwoo'], 'only').map(v => v.id), ['jiwoo-ian']);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Jiwoo'], 'including').map(v => v.id), ['trio-3', 'group-all', 'jiwoo-ian']);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Jiwoo'], 'only').map(v => v.id), []);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Carmen'], 'OR').map(v => v.id), ['solo-carmen', 'duo-carmen-stella', 'trio-3', 'group-all']);
  assert.deepEqual(filterVideosByMembers(withUntagged, ['Carmen', 'Stella'], 'AND').map(v => v.id), ['duo-carmen-stella', 'trio-3', 'group-all']);
  assert.deepEqual(filterVideosByMembers([untagged], ['Carmen'], 'including'), []);
  assert.deepEqual(filterVideosByMembers([untagged], ['Carmen'], 'only'), []);
});

test('classifyVideoGenre accurately categorizes into 5 distinct types', () => {
  // 1. Official Music Videos (MVs)
  assert.equal(classifyVideoGenre("Hearts2Hearts 하츠투하츠 'Next Chapter' MV", '', 'Hearts2Hearts'), 'mv');
  assert.equal(classifyVideoGenre("【MV】Heart Beat Echo", '', 'Hearts2Hearts 官方頻道'), 'mv');
  assert.equal(classifyVideoGenre("Hearts2Hearts 하츠투하츠 'Moonride' Music Video", '', 'SMTOWN'), 'mv');

  // 2. Shorts tab = official channel Shorts/challenges only
  assert.equal(classifyVideoGenre('that one hotpot night.. #Hearts2Hearts #하츠투하츠 #H2H', '', 'Hearts2Hearts'), 'other');
  assert.equal(classifyVideoGenre('STYLE 手勢舞挑戰', '', 'Hearts2Hearts'), 'shorts');
  assert.equal(classifyVideoGenre('Cute moment', '', 'Hearts2Hearts', 'https://youtube.com/shorts/abcdefghijk'), 'shorts');
  assert.equal(classifyVideoGenre('STYLE 手勢舞挑戰', '', '1theK'), 'other');

  // 3. Stage Performances (Music shows + Concerts + Special stages)
  assert.equal(classifyVideoGenre('[#음중직캠] Hearts2Hearts STELLA – STYLE FanCam | 쇼! 음악중심', '', 'MBCkpop'), 'stage');
  assert.equal(classifyVideoGenre('ICONIC HEART - Hearts2Hearts [뮤직뱅크/Music Bank]', '', 'KBS Kpop'), 'stage');
  assert.equal(classifyVideoGenre('Hearts2Hearts - INTRO + Lemon Tang #2026SBS가요대전Summer', '', 'SBS Entertainment'), 'stage');
  assert.equal(classifyVideoGenre('Relay Dance #shorts', '', 'M2'), 'stage');

  // 4. Original Content (Vlogs, reality series, self-produced content)
  assert.equal(classifyVideoGenre('ICONIC POWER RACE | 둘셋하투하 EP.4', '', 'Hearts2Hearts'), 'original');
  assert.equal(classifyVideoGenre('琴房隨筆 VLOG EP.01', '', 'Hearts2Hearts'), 'original');
  assert.equal(classifyVideoGenre('轉學生 Hearts2Hearts | 아는 형님 520회', '', '아는형님 Knowingbros'), 'original');

  // 5. Other Official / Semi-official Content (Behind-the-scenes, interviews, covers, lyric videos, teasers)
  assert.equal(classifyVideoGenre("[Teaser] Hearts2Hearts 'Next Chapter' MV Teaser #1", '', 'Hearts2Hearts'), 'other');
  assert.equal(classifyVideoGenre("Promotion Event in Japan BH2ND #1 (Behind)", '', 'Hearts2Hearts'), 'other');
  assert.equal(classifyVideoGenre("Hearts2Hearts Album Unboxing & Interview", '', 'Hearts2Hearts'), 'other');
});

test('stored mv/stage/original wins, while stored other still yields to a clear title cue', () => {
  assert.equal(classifyVideoGenre("Hearts2Hearts 'FOCUS' MV", '', 'SMTOWN', '', 'mv'), 'mv');
  assert.equal(classifyVideoGenre('둘셋하투하 EP.7', '', 'Hearts2Hearts', '', 'stage'), 'stage');
  assert.equal(classifyVideoGenre('Hearts2Hearts JIWOO FanCam', '', 'MBCkpop', '', 'original'), 'original');
  assert.equal(classifyVideoGenre('Random hashtag clip #Hearts2Hearts', '', 'Hearts2Hearts', '', 'other'), 'other');
  const musicCore = mapSupabaseRowToVideoItem({
    youtube_id: 'abcdefghijk',
    type: 'other',
    channel: 'MBCkpop',
    title: 'Hearts2Hearts (하츠투하츠) - ICONIC HEART (Korean Ver.) | Show! MusicCore | MBC261017방송',
  });
  assert.equal(musicCore.type, 'video');
  assert.equal(musicCore.genre, 'stage');
});

test('real title and channel cues stay out of other', () => {
  assert.equal(
    classifyVideoGenre("Hearts2Hearts 하츠투하츠 'ICONIC HEART (Korean Ver.)' MV", '', 'SMTOWN'),
    'mv',
  );
  assert.equal(
    classifyVideoGenre('ICONIC HEART (Korean Ver.) - Hearts2Hearts [뮤직뱅크/Music Bank] | KBS 261016 방송', '', 'KBS Kpop'),
    'stage',
  );
  assert.equal(
    classifyVideoGenre('[쇼챔직캠 4K] Hearts2Hearts JIWOO (하츠투하츠 지우) - Lemon Tang | Show Champion | EP.602 | 260708', '', 'ALL THE K-POP'),
    'stage',
  );
  assert.equal(
    classifyVideoGenre('轉學生 Hearts2Hearts | 아는 형님 520회', '', '아는형님 Knowingbros'),
    'original',
  );
  assert.equal(
    classifyVideoGenres('Cute moment', '', 'Hearts2Hearts', 'https://www.youtube.com/shorts/abcdefghijk', 'shorts')[0],
    'shorts',
  );
  assert.equal(classifyVideoGenre('STYLE 手勢舞挑戰', '', '1theK'), 'other');
  assert.equal(classifyVideoGenre("[Teaser] Hearts2Hearts 'The Chase' MV Teaser", '', 'SMTOWN'), 'other');
  assert.equal(
    classifyVideoGenre('#shorts #하츠투하츠 컴백인터뷰 (Hearts2Hearts Interview) [뮤직뱅크/Music Bank]', '', 'KBS Kpop'),
    'other',
  );
  assert.equal(
    classifyVideoGenre('[쇼챔 1위] Hearts2Hearts - Lemon Tang 수상소감 Full ver.', '', 'ALL THE K-POP'),
    'other',
  );
  assert.equal(
    classifyVideoGenre('hit you right #Hearts2Hearts #하츠투하츠 #H2H #15LOVE', '', 'Hearts2Hearts'),
    'other',
  );
});

test('official Hearts2Hearts Shorts stay on the Shorts tab, including hashtag-only captions', () => {
  const hashtag = 'oh♥ #Hearts2Hearts #하츠투하츠 #H2H #YE_ON #예온';
  const shortsUrl = 'https://www.youtube.com/shorts/abcdefghijk';
  for (const genres of [
    classifyVideoGenres(hashtag, '', 'Hearts2Hearts', '', 'shorts'),
    classifyVideoGenres(hashtag, '', 'Hearts2Hearts', shortsUrl, 'other'),
    classifyVideoGenres(hashtag, '', 'Hearts2Hearts', shortsUrl, 'video'),
    classifyVideoGenres(hashtag, '#shorts', 'Hearts2Hearts 官方頻道', '', 'video'),
    classifyVideoGenres("[Teaser] Hearts2Hearts 'FOCUS' MV Teaser #shorts", '', 'Hearts2Hearts', '', 'video'),
    classifyVideoGenres('컴백인터뷰 Hearts2Hearts Interview #shorts', '', 'Hearts2Hearts', '', 'shorts'),
    classifyVideoGenres(hashtag, '', 'SMTOWN', shortsUrl, 'mv', 'UC7Q3HUnJA3nvjZR2JeMn2Cw'),
  ]) {
    assert.equal(genres[0], 'shorts');
    assert.ok(genres.includes('shorts'));
  }
  assert.deepEqual(
    classifyVideoGenres('hit you right #Hearts2Hearts #하츠투하츠 #H2H #15LOVE', '', 'Hearts2Hearts'),
    ['other'],
  );
  assert.equal(
    classifyVideoGenre('oh♥ #Hearts2Hearts #H2H', '', '1theK', shortsUrl, 'shorts'),
    'other',
  );
});

test('官方綜藝/物料 is the visible name of the original tab', () => {
  assert.equal(FIVE_CATEGORIES.original.label, '官方綜藝/物料');
  assert.equal(FIVE_CATEGORIES.original.englishLabel, 'Official Variety / Content');
  assert.equal(FIVE_CATEGORIES.original.shortLabel, '綜藝');
});

test('teasers stay other and trailers go to 官方綜藝/物料 unless they are official Shorts', () => {
  const shortsUrl = 'https://www.youtube.com/shorts/abcdefghijk';
  const teasers = [
    "Hearts2Hearts 'ICONIC HEART' MV Teaser",
    '[Teaser] Hearts2Hearts Carmen Artist Teaser',
    '하츠투하츠 FOCUS 티저',
    "Hearts2Hearts 'FOCUS' MV Teaser Trailer",
  ];
  for (const title of teasers) {
    assert.equal(classifyVideoGenre(title, '', 'Hearts2Hearts'), 'other');
    assert.equal(classifyVideoGenre(title, '', 'SMTOWN', '', 'mv'), 'other');
    assert.deepEqual(classifyVideoGenres(title, '', '1theK', shortsUrl, 'shorts'), ['other']);
  }
  const trailers = [
    "Hearts2Hearts 2026 Season's Greetings Trailer",
    "SEASON'S GREETINGS TRAILER",
    'Hearts2Hearts Season Greeting trailer',
    'Hearts2Hearts 시즌그리팅 트레일러',
  ];
  for (const title of trailers) {
    assert.equal(classifyVideoGenre(title, '', 'Hearts2Hearts'), 'original');
    assert.equal(classifyVideoGenre(title, '', 'SMTOWN', '', 'mv'), 'original');
    assert.equal(classifyVideoGenre(title, '', 'SMTOWN', '', 'other'), 'original');
  }
  assert.equal(classifyVideoGenre("Hearts2Hearts 'ICONIC HEART' MV", '', 'SMTOWN'), 'mv');
  assert.deepEqual(
    classifyVideoGenres("Hearts2Hearts 'FOCUS' MV Teaser", '', 'Hearts2Hearts', shortsUrl, 'video'),
    ['shorts'],
  );
  assert.deepEqual(
    classifyVideoGenres("Hearts2Hearts 2026 Season's Greetings Trailer", '', 'Hearts2Hearts', shortsUrl, 'video'),
    ['shorts'],
  );
});


