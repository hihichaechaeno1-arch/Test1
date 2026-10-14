const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const SYNC_MODE = process.env.SYNC_MODE || 'full_backfill';
const DEBUT_DATE_ISO = '2025-01-01T00:00:00Z';

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少必要的環境變數 (YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { autoRefreshToken: false, createClient: () => null }
});

// ⭐ 你指定的必抓 YouTube 播放清單 (保證 100% 全數收錄)
const TRACKED_PLAYLISTS = [
  {
    name: 'Hearts2Hearts Curated Playlist',
    playlistId: 'PLHhitGId-8_9aLsTwJimaXZcjGBlPzrlh',
    skipKeywordFilter: true // 清單內的影片全部直接收錄，唔怕漏片
  }
];

// 8 位成員中英韓別名字典
const MEMBER_MAP = {
  'Carmen': ['carmen', '카르멘'],
  'Jiwoo': ['jiwoo', '지우'],
  'Yuha': ['yuha', '유하'],
  'Stella': ['stella', '스텔라'],
  'Juun': ['juun', '준'],
  'A-na': ['a-na', 'ana', '에이나', '아나'],
  'Ian': ['ian', '이안'],
  'Ye-on': ['ye-on', 'yeon', '예온']
};

const ALL_MEMBERS = Object.keys(MEMBER_MAP);

function detectMembers(text) {
  if (!text) return ALL_MEMBERS;
  const content = text.toLowerCase();
  const matched = [];
  for (const [name, aliases] of Object.entries(MEMBER_MAP)) {
    if (aliases.some(alias => content.includes(alias))) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : ALL_MEMBERS;
}

function isH2HRelated(title, description) {
  const fullText = `${title} ${description}`.toLowerCase();
  const groupKeywords = ['hearts2hearts', 'hearts 2 hearts', '하츠투하츠', 'h2h'];
  if (groupKeywords.some(k => fullText.includes(k))) return true;
  return Object.values(MEMBER_MAP).flat().some(alias => fullText.includes(alias));
}

function loadChannels() {
  const configPath = path.join(__dirname, '..', 'config', 'youtube-channels.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.channels || []);
  }
  return [];
}

async function resolveChannelId(channel) {
  if (channel.channelId && channel.channelId.startsWith('UC')) {
    return channel.channelId;
  }
  const handle = channel.handle || channel.customUrl || '';
  if (handle.startsWith('@')) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.items && data.items[0]?.id) {
      return data.items[0].id;
    }
  }
  return null;
}

async function saveVideoToSupabase({ videoId, title, description, publishedAt, channelTitle }) {
  if (!videoId || videoId.length < 5) return false;
  // 跳過已被設為 Private 或 Deleted 嘅無效清單影片
  if (title === 'Private video' || title === 'Deleted video') return false;

  const isShorts = `${title} ${description}`.toLowerCase().includes('#shorts') || `${title}`.toLowerCase().includes('shorts');
  const type = isShorts ? 'shorts' : 'video';
  const videoUrl = isShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const members = detectMembers(`${title} ${description}`);
  const pubDate = (publishedAt || '').split('T')[0] || '2025-02-24';

  const { data: existing } = await supabase
    .from('videos')
    .select('id')
    .eq('url', videoUrl)
    .maybeSingle();

  if (existing) {
    return false;
  }

  const payload = {
    title,
    url: videoUrl,
    thumbnail,
    channel: channelTitle || 'Hearts2Hearts',
    type,
    published_at: pubDate,
    members
  };

  const { error } = await supabase.from('videos').insert({
    ...payload,
    description: description || ''
  });

  if (error) {
    const { error: retryErr } = await supabase.from('videos').insert(payload);
    if (retryErr) {
      console.error(`❌ 寫入失敗 [${title}]:`, retryErr.message);
      return false;
    }
  }

  console.log(`🎉 [新增入庫] [${pubDate}] [${channelTitle}] ${title}`);
  return true;
}

// 通用 Playlist 翻頁抓取器（同時支援你指定的 Playlist 同埋官方頻道的 UU Uploads 清單）
async function syncPlaylistById(playlistId, labelName, maxPages, skipKeywordFilter = false) {
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`\n📂 開始掃描播放清單 [${labelName}] (ID: ${playlistId}, 最多翻 ${maxPages} 頁)...`);

  do {
    page++;
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

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
      // 優先取影片真實發布時間 (contentDetails.videoPublishedAt)，若無才取加入清單時間
      const publishedAt = item.contentDetails?.videoPublishedAt || snippet.publishedAt || '';
      const channelTitle = snippet.videoOwnerChannelTitle || snippet.channelTitle || labelName;

      if (!skipKeywordFilter && !isH2HRelated(title, description)) {
        continue;
      }

      const ok = await saveVideoToSupabase({ videoId, title, description, publishedAt, channelTitle });
      if (ok) added++;
    }

    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken && page < maxPages);

  console.log(`✅ [${labelName}] 掃描咗 ${page} 頁，共新增 ${added} 條影片`);
  return added;
}

async function syncChannelSearch(channelId, channelName, maxPages) {
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`\n🔍 在電視台頻道 [${channelName}] 內搜尋 Hearts2Hearts (最多翻 ${maxPages} 頁)...`);

  do {
    page++;
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=${encodeURIComponent('Hearts2Hearts | 하츠투하츠')}&type=video&order=date&maxResults=50&publishedAfter=${DEBUT_DATE_ISO}&key=${YOUTUBE_API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

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

      if (!isH2HRelated(title, description)) continue;

      const ok = await saveVideoToSupabase({ videoId, title, description, publishedAt, channelTitle });
      if (ok) added++;
    }

    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken && page < maxPages);

  console.log(`✅ [${channelName}] 搜尋咗 ${page} 頁，共新增 ${added} 條影片`);
  return added;
}

async function main() {
  console.log(`==================================================`);
  console.log(`🚀 啟動 YouTube 同步腳本 | 模式: ${SYNC_MODE}`);
  console.log(`==================================================`);

  let totalAdded = 0;

  // 1. 優先完整掃描你指定的 Playlist (最多翻 30 頁 = 1,500 條片，確保全數抓齊)
  for (const pl of TRACKED_PLAYLISTS) {
    totalAdded += await syncPlaylistById(pl.playlistId, pl.name, 30, pl.skipKeywordFilter);
  }

  // 2. 掃描 config/youtube-channels.json 內的官方與電視台頻道
  const channels = loadChannels();
  const officialMaxPages = SYNC_MODE === 'full_backfill' ? 20 : 2;
  const broadcastMaxPages = SYNC_MODE === 'full_backfill' ? 5 : 1;

  for (const ch of channels) {
    const name = ch.name || ch.title || ch.handle;
    const channelId = await resolveChannelId(ch);

    if (!channelId) {
      console.warn(`⚠️ 無法解析頻道 ID: ${name}，跳過`);
      continue;
    }

    const isOfficialMain = name.toLowerCase().includes('hearts2hearts') || (ch.handle || '').toLowerCase().includes('hearts2hearts');

    if (isOfficialMain) {
      const uploadsPlaylistId = 'UU' + channelId.slice(2);
      totalAdded += await syncPlaylistById(uploadsPlaylistId, name, officialMaxPages, true);
    } else {
      totalAdded += await syncChannelSearch(channelId, name, broadcastMaxPages);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 同步任務完成！本次共新增 ${totalAdded} 條影片入 Supabase`);
  console.log(`==================================================`);
}

main();
