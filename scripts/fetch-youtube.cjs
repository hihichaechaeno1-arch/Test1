const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 讀取執行模式：'incremental' (日常檢查最新) 或 'full_backfill' (抓取自出道以來所有舊片)
const SYNC_MODE = process.env.SYNC_MODE || 'incremental';
// Hearts2Hearts 出道年份起點 (2025年初預熱與出道)
const DEBUT_DATE_ISO = '2025-01-01T00:00:00Z';

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少必要的環境變數 (YOUTUBE_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { autoRefreshToken: false, createClient: () => null }
});

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

// 載入 config/youtube-channels.json
function loadChannels() {
  const configPath = path.join(__dirname, '..', 'config', 'youtube-channels.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Array.isArray(raw) ? raw : (raw.channels || []);
  }
  return [];
}

// 透過 handle (@xxx) 或名稱反查官方 Channel ID (UC...)
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

// 儲存單條影片入 Supabase (Upsert 防重複)
async function saveVideoToSupabase({ videoId, title, description, publishedAt, channelTitle }) {
  if (!videoId || videoId.length < 5) return false;

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
    return false; // 已存在則跳過
  }

  const payload = {
    title,
    url: videoUrl,
    thumbnail,
    channel: channelTitle,
    type,
    published_at: pubDate,
    members
  };

  // 如果資料庫已經跑咗 add_videos_description migration，一併存入 description
  const { error } = await supabase.from('videos').insert({
    ...payload,
    description: description || ''
  });

  if (error) {
    // 若因無 description 欄位報錯，退回基礎欄位寫入
    const { error: retryErr } = await supabase.from('videos').insert(payload);
    if (retryErr) {
      console.error(`❌ 寫入失敗 [${title}]:`, retryErr.message);
      return false;
    }
  }

  console.log(`🎉 [新增入庫] [${pubDate}] [${channelTitle}] ${title}`);
  return true;
}

// 針對官方主頻道：利用 Uploads Playlist (UU...) 100% 翻頁抓齊出道至今每一條片 (極慳 Quota)
async function syncUploadsPlaylist(channelId, channelName, maxPages) {
  const uploadsPlaylistId = 'UU' + channelId.slice(2);
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`📂 使用 Uploads 清單 (${uploadsPlaylistId}) 深度掃描 [${channelName}] (最多翻 ${maxPages} 頁)...`);

  do {
    page++;
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
    if (nextPageToken) url += `&pageToken=${nextPageToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      console.error(`⚠️ Playlist 讀取錯誤 (${channelName}):`, data.error.message);
      break;
    }

    const items = data.items || [];
    if (items.length === 0) break;

    for (const item of items) {
      const snippet = item.snippet || {};
      const videoId = snippet.resourceId?.videoId;
      const title = snippet.title || '';
      const description = snippet.description || '';
      const publishedAt = snippet.publishedAt || '';
      const channelTitle = snippet.videoOwnerChannelTitle || snippet.channelTitle || channelName;

      // 如果是電視台頻道，必須過濾出同 Hearts2Hearts 相關嘅片，而且唔早於出道年份
      const isOfficialMain = channelName.toLowerCase().includes('hearts2hearts');
      if (!isOfficialMain && !isH2HRelated(title, description)) {
        continue;
      }

      const ok = await saveVideoToSupabase({ videoId, title, description, publishedAt, channelTitle });
      if (ok) added++;
    }

    nextPageToken = data.nextPageToken || '';
  } while (nextPageToken && page < maxPages);

  console.log(`✅ [${channelName}] 掃描咗 ${page} 頁，新增咗 ${added} 條影片`);
  return added;
}

// 針對大型電視台頻道：喺頻道內搜尋 Hearts2Hearts 並支援向後翻頁抓齊自出道以來嘅舞台
async function syncChannelSearch(channelId, channelName, maxPages) {
  let nextPageToken = '';
  let page = 0;
  let added = 0;

  console.log(`🔍 在電視台頻道 [${channelName}] 內深度搜尋 Hearts2Hearts (最多翻 ${maxPages} 頁)...`);

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
      if (snippet.channelId !== channelId) continue; // 嚴格鎖定頻道 ID

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

  console.log(`✅ [${channelName}] 搜尋咗 ${page} 頁，新增咗 ${added} 條影片`);
  return added;
}

async function main() {
  console.log(`==================================================`);
  console.log(`🚀 啟動 YouTube 同步腳本 | 模式: ${SYNC_MODE}`);
  console.log(`==================================================`);

  const channels = loadChannels();
  let totalAdded = 0;

  // 如果係 full_backfill 模式，官方主頻道翻最多 20 頁 (1,000條片，足夠覆蓋出道至今所有片)，電視台頻道翻最多 5 頁 (250條片)
  // 如果係日常 incremental 模式，只翻第 1 頁
  const officialMaxPages = SYNC_MODE === 'full_backfill' ? 20 : 1;
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
      // 官方主頻道直接抽整個 Uploads 清單，100% 唔會漏任何一條舊片或 Shorts！
      totalAdded += await syncUploadsPlaylist(channelId, name, officialMaxPages);
    } else {
      // 電視台頻道用 publishedAfter=2025-01-01 + 翻頁搜尋
      totalAdded += await syncChannelSearch(channelId, name, broadcastMaxPages);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 同步任務完成！本次共新增 ${totalAdded} 條影片入 Supabase`);
  console.log(`==================================================`);
}

main();
