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

// 1. 你指定的必抓 YouTube 播放清單 (清單內的片 100% 全部直接收錄)
const TRACKED_PLAYLISTS = [
  {
    name: 'Hearts2Hearts Curated Playlist',
    playlistId: 'PLHhitGId-8_9aLsTwJimaXZcjGBlPzrlh',
    skipKeywordFilter: true
  }
];

// 2. 8 位成員精確比對規則（使用正則邊界，防止將韓文 준비 當成 준，或將英文單字當成 ana/ian）
const MEMBER_PATTERNS = {
  'Carmen': [/\bcarmen\b/i, /카르멘/],
  'Jiwoo': [/\bjiwoo\b/i, /지우/],
  'Yuha': [/\byuha\b/i, /유하/],
  'Stella': [/\bstella\b/i, /스텔라/],
  'Juun': [/\bjuun\b/i, /(?<![가-힣])준(?![가-힣])/],
  'A-na': [/\ba-na\b/i, /에이나/],
  'Ian': [/\bian\b/i, /이안/],
  'Ye-on': [/\bye-on\b/i, /예온/]
};

const ALL_MEMBERS = Object.keys(MEMBER_PATTERNS);

function detectMembers(text) {
  if (!text) return ALL_MEMBERS;
  const content = String(text);
  const matched = [];
  for (const [name, patterns] of Object.entries(MEMBER_PATTERNS)) {
    if (patterns.some(regex => regex.test(content))) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : ALL_MEMBERS;
}

// 3. 嚴格檢查：外部電視台頻道的「影片標題 (Title)」必須明確包含 Hearts2Hearts 或 하츠투하츠
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

        if (!skipKeywordFilter && !isH2HRelated(title)) {
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

        // 強制規定：電視台搜尋結果的「標題」必須有 Hearts2Hearts 或 하츠투하츠
        if (!isH2HRelated(title)) continue;

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

  // 第一部分：優先 100% 掃描你指定的 Playlist (最多翻 30 頁 = 1,500 條片)
  for (const pl of TRACKED_PLAYLISTS) {
    totalAdded += await syncPlaylistById(supabase, pl.playlistId, pl.name, 30, pl.skipKeywordFilter);
  }

  // 第二部分：掃描 config/youtube-channels.json 內的官方與電視台頻道
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
