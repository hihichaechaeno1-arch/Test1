const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== [1] 檢查環境變數 ===');
console.log('SUPABASE_URL 存在:', Boolean(SUPABASE_URL));
console.log('SUPABASE_SERVICE_ROLE_KEY 存在:', Boolean(SUPABASE_SERVICE_ROLE_KEY));
console.log('YOUTUBE_API_KEY 存在:', Boolean(YOUTUBE_API_KEY));

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 錯誤：GitHub Secrets 變數有缺少，請檢查 Settings -> Secrets -> Actions！');
  process.exit(1);
}

const MEMBER_MAP = {
  'Carmen': ['carmen', '카르멘'],
  'Jiwoo': ['jiwoo', '지우'],
  'Yuha': ['yuha', '유하'],
  'Stella': ['stella', '스텔拉', '스텔라'],
  'Juun': ['juun', '준'],
  'A-na': ['a-na', 'ana', '아나'],
  'Ian': ['ian', '이안'],
  'Ye-on': ['ye-on', 'yeon', '예온']
};

function detectMembers(text) {
  if (!text) return [];
  const content = text.toLowerCase();
  const matched = [];
  for (const [name, aliases] of Object.entries(MEMBER_MAP)) {
    if (aliases.some(alias => content.includes(alias))) {
      matched.push(name);
    }
  }
  return matched;
}

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('=== [2] 發送 YouTube API 請求 ===');
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=Hearts2Hearts&maxResults=10&order=date&type=video&key=${YOUTUBE_API_KEY}`;

  let data;
  try {
    const res = await fetch(searchUrl);
    data = await res.json();
  } catch (netErr) {
    console.error('❌ 網絡連線錯誤:', netErr);
    process.exit(1);
  }

  if (data.error) {
    console.error('❌ YouTube API 回傳報錯:', JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  if (!data.items || data.items.length === 0) {
    console.log('⚠️ YouTube 冇回傳任何影片。');
    return;
  }

  console.log(`=== [3] 成功取得 ${data.items.length} 條影片，開始同步至 Supabase ===`);

  for (const item of data.items) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;

    const title = item.snippet.title || '';
    const publishedAt = (item.snippet.publishedAt || '').split('T')[0] || '2026-10-01';
    const channelTitle = item.snippet.channelTitle || 'Hearts2Hearts';
    const thumbnail = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || '';

    const isShorts = title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('shorts');
    const type = isShorts ? 'shorts' : 'video';
    const videoUrl = isShorts
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;

    const members = detectMembers(title + ' ' + (item.snippet.description || ''));

    const { data: existing, error: selectErr } = await supabase
      .from('videos')
      .select('id')
      .eq('url', videoUrl)
      .maybeSingle();

    if (selectErr) {
      console.error('查詢資料庫錯誤:', selectErr.message);
      continue;
    }

    if (!existing) {
      const { error: insertErr } = await supabase.from('videos').insert({
        title,
        url: videoUrl,
        thumbnail,
        channel: channelTitle,
        type,
        published_at: publishedAt,
        members: members
      });

      if (insertErr) {
        console.error(`❌ 寫入失敗 [${title}]:`, insertErr.message);
      } else {
        console.log(`🎉 成功入庫: ${title} | 成員: [${members.join(', ')}]`);
      }
    } else {
      console.log(`⏭️ 已存在跳過: ${title}`);
    }
  }

  console.log('=== [4] 全部自動同步順利完成 ===');
}

run();
