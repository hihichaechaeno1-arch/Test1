const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 自動支援所有常見的環境變數命名，防止因為 Secret 名稱微調而報錯失敗
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

// ⭐ 你指定的必抓 YouTube 播放清單 (保證 100% 由頭到尾全數收錄)
const TRACKED_PLAYLISTS = [
  {
    name: 'Hearts2Hearts Curated Playlist',
    playlistId: 'PLHhitGId-8_9aLsTwJimaXZcjGBlPzrlh',
    skipKeywordFilter: true
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
  const content = String(text).toLowerCase();
  const matched = [];
  for (const [name, aliases] of Object.entries(MEMBER_MAP)) {
    if (aliases.some(alias => content.includes(alias))) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : ALL_MEMBERS;
}

function isH2HRelated(title, description) {
  const fullText = `${title || ''} ${description || ''}`.toLowerCase();
  const groupKeywords = ['hearts2hearts', 'hearts 2 hearts', '하츠투하츠', 'h2h'];
  if (groupKeywords.some(k => fullText.includes(k))) return true;
  return Object.values(MEMBER_MAP).flat().some(alias => fullText.includes(alias));
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

async function saveVideoToSupabase(supabase, { videoId, title, description, publishedAt, channelTitle }) {
  if (!videoId || String(videoId).length < 5) return false;
  if (title === 'Private video' || title === 'Deleted video') return false;

  const isShorts = `${title} ${description}`.toLowerCase().includes('#shorts') || `${title}`.toLowerCase().includes('shorts');
  const type = isShorts ? 'shorts' : 'video';
  const videoUrl = isShorts
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const members = detectMembers(`${title} ${description}`);
  const pubDate = (publishedAt || '').split('T')[0] || '2025-02-24';

  const { data: existing, error: selectErr } = await supabase
    .from('videos')
    .select('id')
    .eq('url', videoUrl)
    .maybeSingle();

  if (selectErr) {
    console.error(`⚠️ 查詢資料庫錯誤 [${title}]:`, selectErr.message);
    return false;
  }

  if (existing) {
    return false;
  }

  const basePayload = {
    title,
    url: videoUrl,
    thumbnail,
    channel: channelTitle || 'Hearts2Hearts',
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

  console.log(`🎉 [新增入庫] [${pubDate}] [${channelTitle}] ${title}`);
  return true;
}

async function syncPlaylistById(supabase, playlistId, labelName, maxPages, skipKeywordFilter = false) {
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

        if (!skipKeywordFilter && !isH2HRelated(title, description)) {
          continue;
        }

        const ok = await saveVideoToSupabase(supabase, { videoId, title, description, publishedAt, channelTitle });
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
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=${encodeURIComponent('Hearts2Hearts | 하츠투하츠')}&type=video&order=date&maxResults=50&publishedAfter=${DEBUT_DATE_ISO}&key=${YOUTUBE_API_KEY}`;
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

        if (!isH2HRelated(title, description)) continue;

        const ok = await saveVideoToSupabase(supabase, { videoId, title, description, publishedAt, channelTitle });
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
  console.log(`🔑 YOUTUBE_API_KEY 已載入: ${Boolean(YOUTUBE_API_KEY)}`);
  console.log(`🌐 SUPABASE_URL: ${SUPABASE_URL}`);
  console.log(`🔐 SUPABASE_KEY 已載入: ${Boolean(SUPABASE_KEY)}`);
  console.log(`==================================================`);

  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) {
    console.error('❌ 缺少 YOUTUBE_API_KEY 或 SUPABASE_SERVICE_ROLE_KEY！請到 GitHub Settings -> Secrets and variables -> Actions 確認已設定這兩個 Repository Secrets。');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
    realtime: { autoRefreshToken: false, createClient: () => null }
  });

  let totalAdded = 0;

  // 1. 優先完整掃描你指定的 Playlist (最多翻 30 頁 = 1,500 條片)
  for (const pl of TRACKED_PLAYLISTS) {
    totalAdded += await syncPlaylistById(supabase, pl.playlistId, pl.name, 30, pl.skipKeywordFilter);
  }

  // 2. 掃描 config/youtube-channels.json 內的官方與電視台頻道
  const channels = loadChannels();
  const officialMaxPages = SYNC_MODE === 'full_backfill' ? 20 : 2;
  const broadcastMaxPages = SYNC_MODE === 'full_backfill' ? 5 : 1;

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
      const uploadsPlaylistId = 'UU' + channelId.slice(2);
      totalAdded += await syncPlaylistById(supabase, uploadsPlaylistId, name, officialMaxPages, true);
    } else {
      totalAdded += await syncChannelSearch(supabase, channelId, name, broadcastMaxPages);
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 同步任務完成！本次共新增 ${totalAdded} 條影片入 Supabase`);
  console.log(`==================================================`);
}

// 只有直接透過 node scripts/fetch-youtube.cjs 執行時先會跑 main()，避免被其他測試檔引入時崩潰
if (require.main === module) {
  main().catch(err => {
    console.error('❌ 執行過程發生未預期錯誤:', err);
    process.exit(1);
  });
}

module.exports = {
  detectMembers,
  isH2HRelated,
  loadChannels,
  resolveChannelId,
  syncPlaylistById,
  syncChannelSearch,
  main
};
