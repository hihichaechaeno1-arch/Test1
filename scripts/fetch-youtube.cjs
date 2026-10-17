const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = (process.env.YOUTUBE_API_KEY || '').trim();
const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://lxattufhisuyyhbtmmuf.supabase.co'
).trim();

const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim();

const SYNC_MODE = process.env.SYNC_MODE || 'full_backfill';
const DEBUT_DATE_ISO = '2025-01-01T00:00:00Z';

const TRACKED_PLAYLISTS = [
  {
    name: 'Hearts2Hearts Curated Playlist',
    playlistId: 'PLHhitGId-8_9aLsTwJimaXZcjGBlPzrlh',
    skipKeywordFilter: true
  }
];

const MEMBER_PATTERNS = {
  'Carmen': [/\bcarmen\b/i, /카르멘/],
  'Jiwoo': [/\bjiwoo\b/i, /지우/],
  'Yuha': [/\byuha\b/i, /유하/],
  'Stella': [/\bstella\b/i, /스텔라/],
  'Juun': [/\bjuun\b/i, /(?<![가-힣])준(?![가-힣])/],
  'A-na': [/\ba-na\b/i, /\bana\b/i, /에이나/],
  'Ian': [/\bian\b/i, /이안/],
  'Ye-on': [/\bye-on\b/i, /\byeon\b/i, /예온/]
};

const ALL_MEMBERS = Object.keys(MEMBER_PATTERNS);

function detectMembers(title = '', description = '') {
  // 優先檢查標題
  const matchedInTitle = [];
  for (const [name, patterns] of Object.entries(MEMBER_PATTERNS)) {
    if (patterns.some(regex => regex.test(String(title)))) {
      matchedInTitle.push(name);
    }
  }
  if (matchedInTitle.length > 0 && matchedInTitle.length < ALL_MEMBERS.length) {
    return matchedInTitle;
  }

  const content = `${title} ${String(description || '').slice(0, 200)}`;
  const matched = [];
  for (const [name, patterns] of Object.entries(MEMBER_PATTERNS)) {
    if (patterns.some(regex => regex.test(content))) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : ALL_MEMBERS;
}

function isOfficialChannelName(channelTitle = '') {
  const c = String(channelTitle || '').toLowerCase();
  return c.includes('hearts2hearts') || c.includes('hearts 2 hearts') || c.includes('하츠투하츠');
}

// 自動將影片歸入 5 大類別：'mv' | 'shorts' | 'stage' | 'original' | 'other'
function classifyVideoType(title = '', description = '', channelTitle = '', forceOfficialShorts = false) {
  const t = String(title).toLowerCase();
  const d = String(description).toLowerCase();
  const c = String(channelTitle).toLowerCase();
  const isOfficial = isOfficialChannelName(c);

  // 1. Shorts / Challenges：只限 Hearts2Hearts 官方頻道！
  const hasShortsKeyword =
    forceOfficialShorts ||
    t.includes('#shorts') ||
    /\bshorts\b/i.test(t) ||
    t.includes('challenge') ||
    t.includes('챌린지') ||
    d.includes('#shorts');

  if (isOfficial && hasShortsKeyword) {
    return 'shorts';
  }

  // 2. Official MV (排除 MV Commentary、Teaser、Behind、Reaction 等)
  const isNotPureMv =
    /(commentary|코멘터리|teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버|fancam|직캠|facecam|페이스캠|stage|inkigayo|인기가요|뮤직뱅크|음악중심|엠카운트다운|dance practice|안무|cheer guide|응원법)/i.test(
      t
    );
  if (
    !isNotPureMv &&
    (/\bmv\b/i.test(t) ||
      t.includes('m/v') ||
      t.includes('music video') ||
      t.includes('뮤직비디오') ||
      t.includes('official video') ||
      t.includes('track video'))
  ) {
    return 'mv';
  }

  // 3. Stage / Performance (包含 SBS Entertainment 的舞台片)
  const isPureVarietyTitle =
    /(아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|돌박이일|워크돌|동네스타k|스브스뉴스|문명특급|살롱드립|집대성|할명수|리무진서비스)/i.test(
      t
    );
  const isBehindOrVlog =
    /(behind|비하인드|making|메이킹|vlog|브이로그|commentary|코멘터리|interview|인터뷰)/i.test(t);

  if (
    !isBehindOrVlog &&
    !isPureVarietyTitle &&
    (/(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live|sbs entertainment)/i.test(c) ||
      /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠|가요대전|gayo daejeon|무대)/i.test(
        t
      ))
  ) {
    return 'stage';
  }

  // 4. Variety Show
  if (
    /(knowingbros|아는형님|런닝맨|jtbcentertainment)/i.test(c) ||
    /(vlog|브이로그|\bep\.|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|예능|variety)/i.test(
      t
    ) ||
    isPureVarietyTitle
  ) {
    return 'original';
  }

  // 5. Other Video (包含 MV Commentary 等)
  return 'other';
}

function isH2HRelated(title) {
  const titleText = String(title || '').toLowerCase();
  const groupKeywords = ['hearts2hearts', 'hearts 2 hearts', '하츠투하츠'];
  return groupKeywords.some(k => titleText.includes(k));
}

function loadChannels() {
  const configPath = path.join(__dirname, '..', 'config', 'youtube-channels.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return Array.isArray(raw) ? raw : (raw.channels || []);
    }
  } catch (err) {
    console.warn('⚠️ 讀取 config/youtube-channels.json 失敗:', err.message);
  }
  return [];
}

async function resolveChannelId(channel) {
  if (!channel) return null;
  if (channel.channelId && String(channel.channelId).startsWith('UC')) {
    return channel.channelId;
  }
  if (channel.id && String(channel.id).startsWith('UC')) {
    return channel.id;
  }
  const handle = channel.handle || channel.customUrl || '';
  if (handle.startsWith('@')) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.items && data.items[0]?.id) {
        return data.items[0].id;
      }
    } catch (err) {
      console.warn(`⚠️ 反查 Handle (${handle}) 失敗:`, err.message);
    }
  }
  return null;
}

async function saveVideoToSupabase(
  supabase,
  { videoId, title, description, publishedAt, channelTitle, forceOfficialShorts = false }
) {
  if (!videoId || String(videoId).length < 5) return false;
  if (title === 'Private video' || title === 'Deleted video') return false;

  const isOfficial = isOfficialChannelName(channelTitle);
  const type = classifyVideoType(title, description, channelTitle, forceOfficialShorts);
  const isShorts = type === 'shorts' || forceOfficialShorts;

  const videoUrl = isShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const members = detectMembers(title, description);
  const pubDate = (publishedAt || '').split('T')[0] || '2025-02-24';

  // 同時檢查 watch?v= 同 /shorts/ 係咪已經存在喺資料庫
  const { data: existingList, error: selectErr } = await supabase
    .from('videos')
    .select('id, type, url')
    .in('url', [watchUrl, shortsUrl]);

  if (selectErr) {
    console.error(`⚠️ 查詢資料庫錯誤 [${title}]:`, selectErr.message);
    return false;
  }

  if (existingList && existingList.length > 0) {
    const existing = existingList[0];
    // 如果之前被當成普通 video 入咗庫，但其實係官方 Shorts（或者分類改咗），自動更新修復！
    if (existing.type !== type || (isShorts && existing.url !== shortsUrl)) {
      await supabase
        .from('videos')
        .update({ type, url: videoUrl, members })
        .eq('id', existing.id);
      console.log(`🔄 [自動修正分類] [${type.toUpperCase()}] [${pubDate}] ${title}`);
    }
    return false;
  }

  const basePayload = {
    title,
    url: videoUrl,
    thumbnail,
    channel: isOfficial ? 'Hearts2Hearts' : (channelTitle || 'Hearts2Hearts'),
    type,
    published_at: pubDate,
    members
  };

  const { error } = await supabase.from('videos').insert({
    ...basePayload,
    description: description || ''
  });

  if (error) {
    const { error: retryErr } = await supabase.from('videos').insert(basePayload);
    if (retryErr) {
      console.error(`❌ 寫入失敗 [${title}]:`, retryErr.message);
      return false;
    }
  }

  console.log(`🎉 [新增入庫] [${type.toUpperCase()}] [${pubDate}] [${channelTitle}] ${title}`);
  return true;
}

async function syncPlaylistById(
  supabase,
  playlistId,
  labelName,
  maxPages,
  skipKeywordFilter = false,
  forceOfficialShorts = false
) {
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`\n📂 開始掃描播放清單 [${labelName}] (ID: ${playlistId}, 最多翻 ${maxPages} 頁)...`);

  do {
    page++;
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error(`⚠️ Playlist 讀取錯誤 (${labelName}):`, data.error.message);
        break;
      }

      const items = data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        const snippet = item.snippet || {};
        const videoId = snippet.resourceId?.videoId || item.contentDetails?.videoId;
        const title = snippet.title || '';
        const description = snippet.description || '';
        const publishedAt = item.contentDetails?.videoPublishedAt || snippet.publishedAt || '';
        const channelTitle = snippet.videoOwnerChannelTitle || snippet.channelTitle || labelName;

        if (!skipKeywordFilter && !isH2HRelated(title)) {
          continue;
        }

        const ok = await saveVideoToSupabase(supabase, {
          videoId,
          title,
          description,
          publishedAt,
          channelTitle,
          forceOfficialShorts
        });
        if (ok) added++;
      }

      nextPageToken = data.nextPageToken || '';
    } catch (err) {
      console.error(`⚠️ 請求異常 (${labelName}):`, err.message);
      break;
    }
  } while (nextPageToken && page < maxPages);

  console.log(`✅ [${labelName}] 掃描咗 ${page} 頁，共新增 ${added} 條影片`);
  return added;
}

async function syncChannelSearch(supabase, channelId, channelName, maxPages) {
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`\n🔍 在電視台頻道 [${channelName}] 內搜尋 Hearts2Hearts (最多翻 ${maxPages} 頁)...`);

  do {
    page++;
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=${encodeURIComponent('Hearts2Hearts')}&type=video&order=date&maxResults=50&publishedAfter=${DEBUT_DATE_ISO}&key=${YOUTUBE_API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error(`⚠️ Search API 錯誤 (${channelName}):`, data.error.message);
        break;
      }

      const items = data.items || [];
      if (items.length === 0) break;

      for (const item of items) {
        const videoId = item.id?.videoId;
        const snippet = item.snippet || {};
        if (snippet.channelId !== channelId) continue;

        const title = snippet.title || '';
        const description = snippet.description || '';
        const publishedAt = snippet.publishedAt || '';
        const channelTitle = snippet.channelTitle || channelName;

        if (!isH2HRelated(title)) continue;

        const ok = await saveVideoToSupabase(supabase, {
          videoId,
          title,
          description,
          publishedAt,
          channelTitle,
          forceOfficialShorts: false
        });
        if (ok) added++;
      }

      nextPageToken = data.nextPageToken || '';
    } catch (err) {
      console.error(`⚠️ 搜尋異常 (${channelName}):`, err.message);
      break;
    }
  } while (nextPageToken && page < maxPages);

  console.log(`✅ [${channelName}] 搜尋咗 ${page} 頁，共新增 ${added} 條影片`);
  return added;
}

async function main() {
  console.log(`==================================================`);
  console.log(`🚀 啟動 YouTube 同步腳本 | 模式: ${SYNC_MODE}`);
  console.log(`==================================================`);

  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) {
    console.error('❌ 缺少 YOUTUBE_API_KEY 或 SUPABASE_SERVICE_ROLE_KEY！');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    realtime: { autoRefreshToken: false, createClient: () => null }
  });

  let totalAdded = 0;

  for (const pl of TRACKED_PLAYLISTS) {
    totalAdded += await syncPlaylistById(supabase, pl.playlistId, pl.name, 30, pl.skipKeywordFilter, false);
  }

  const channels = loadChannels();
  // 大幅提升官方頻道翻頁上限至 50 頁（可容納 2,500 條片，確保由出道第 1 日開始所有 Shorts 同影片 100% 抓齊！）
  const officialMaxPages = SYNC_MODE === 'full_backfill' ? 50 : 5;
  const broadcastMaxPages = SYNC_MODE === 'full_backfill' ? 8 : 2;

  for (const ch of channels) {
    const name = ch.name || ch.title || ch.handle || 'Unknown Channel';
    const channelId = await resolveChannelId(ch);

    if (!channelId) {
      console.warn(`⚠️ 無法解析頻道 ID: ${name}，跳過`);
      continue;
    }

    const isOfficialMain =
      String(name).toLowerCase().includes('hearts2hearts') ||
      String(ch.handle || '').toLowerCase().includes('hearts2hearts');

    if (isOfficialMain) {
      // 1. 先掃描官方頻道專屬的 Shorts 播放清單 (UUSH...)，確保出道至今所有官方 Shorts 100% 標記為 shorts！
      const officialShortsPlaylistId = 'UUSH' + channelId.slice(2);
      totalAdded += await syncPlaylistById(
        supabase,
        officialShortsPlaylistId,
        `${name} (Official Shorts)`,
        officialMaxPages,
        true,
        true
      );

      // 2. 再掃描官方頻道全部上傳清單 (UU...)
      const uploadsPlaylistId = 'UU' + channelId.slice(2);
      totalAdded += await syncPlaylistById(
        supabase,
        uploadsPlaylistId,
        name,
        officialMaxPages,
        true,
        false
      );
    } else {
      totalAdded += await syncChannelSearch(supabase, channelId, name, broadcastMaxPages);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 同步任務完成！本次共新增 ${totalAdded} 條影片入 Supabase`);
  console.log(`==================================================`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 執行過程發生未預期錯誤:', err);
    process.exit(1);
  });
}

module.exports = {
  detectMembers,
  classifyVideoType,
  isH2HRelated,
  loadChannels,
  resolveChannelId,
  syncPlaylistById,
  syncChannelSearch,
  main
};
