const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 缺少必要的環境變數！');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { autoRefreshToken: false, createClient: () => null }
});

// 8 位成員中英韓比對字典
const MEMBER_MAP = {
  'Carmen': ['carmen', '카르멘'],
  'Jiwoo': ['jiwoo', '지우'],
  'Yuha': ['yuha', '유하'],
  'Stella': ['stella', '스텔라'],
  'Juun': ['juun', '준'],
  'A-na': ['a-na', 'ana', '아나'],
  'Ian': ['ian', '이안'],
  'Ye-on': ['ye-on', 'yeon', '예온']
};

const ALL_MEMBERS = ['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'];

// 嚴格鎖定你提供的 13 個官方與電視台頻道 Channel ID
const TRACKED_CHANNELS = [
  { name: 'Hearts2Hearts Official', query: 'Hearts2Hearts Official', isOfficial: true },
  { name: 'SBSKPOP X INKIGAYO', channelId: 'UCbdf354nngcR1v3nB9g2Lvg', isOfficial: false },
  { name: 'KBS Kpop', channelId: 'UC5BMQOsBh4cmR9-p_gC_4Lw', isOfficial: false },
  { name: 'MBCkpop', channelId: 'UC1ovbpL67nKDvgJc_Tf_p-A', isOfficial: false },
  { name: 'Mnet K-POP', channelId: 'UCbD8EppRX3ZwJSou-TVoKUw', isOfficial: false },
  { name: 'STUDIO CHOOM', channelId: 'UCoHpxO7N2u_xP9Q_m3E6U_A', isOfficial: false },
  { name: 'THE K-POP', channelId: 'UCcvqTgm4a3Y1OvdHj1m7L6A', isOfficial: false },
  { name: 'ALL THE K-POP', channelId: 'UC_7y9N5W4H5L_7w0f4T6r5w', isOfficial: false },
  { name: 'Knowingbros', channelId: 'UCUpJs89f2PmVP8P5n2Q3_3g', isOfficial: false },
  { name: 'JTBC Entertainment', channelId: 'UCvG8yZ0O9rT7gY_J7rZ2w1A', isOfficial: false },
  { name: '런닝맨 - 스브스 공식 채널', channelId: 'UCfN8qjS_q5N6eH7k5k5g3fg', isOfficial: false },
  { name: 'SBS Entertainment', channelId: 'UCgB_0L5o2b3tN-H4m0K1vqw', isOfficial: false }
];

function detectMembers(text) {
  if (!text) return [];
  const content = text.toLowerCase();
  const matched = [];
  for (const [name, aliases] of Object.entries(MEMBER_MAP)) {
    if (aliases.some(alias => content.includes(alias))) {
      matched.push(name);
    }
  }
  return matched.length > 0 ? matched : ALL_MEMBERS;
}

async function fetchFromChannel(channel) {
  let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&order=date&type=video&key=${YOUTUBE_API_KEY}`;
  
  if (channel.channelId) {
    // 嚴格限定喺電視台專屬 Channel ID 內搜尋 Hearts2Hearts 相關片段
    searchUrl += `&channelId=${channel.channelId}&q=${encodeURIComponent('Hearts2Hearts')}`;
  } else {
    // 官方主頻道
    searchUrl += `&q=${encodeURIComponent(channel.query)}`;
  }

  try {
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (!data.items || data.items.length === 0) return 0;

    let count = 0;
    for (const item of data.items) {
      const videoId = item.id?.videoId;
      if (!videoId || typeof videoId !== 'string' || videoId.length < 5) continue;

      const title = item.snippet?.title || '';
      const publishedAt = (item.snippet?.publishedAt || '').split('T')[0] || '2026-10-01';
      const channelTitle = item.snippet?.channelTitle || channel.name;
      
      // 生成 YouTube 官方最高清晰度標準縮圖
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const isShorts = title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('shorts');
      const type = isShorts ? 'shorts' : 'video';
      const videoUrl = isShorts 
        ? `https://www.youtube.com/shorts/${videoId}` 
        : `https://www.youtube.com/watch?v=${videoId}`;

      const members = detectMembers(title + ' ' + (item.snippet?.description || ''));

      // 檢查 Supabase 是否已存在相同網址
      const { data: existing } = await supabase
        .from('videos')
        .select('id')
        .eq('url', videoUrl)
        .maybeSingle();

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

        if (!insertErr) {
          count++;
          console.log(`✅ [${channelTitle}] 成功入庫: ${title}`);
        }
      }
    }
    return count;
  } catch (err) {
    console.error(`掃描錯誤 (${channel.name}):`, err.message);
    return 0;
  }
}

async function run() {
  console.log('=== 開始針對 13 個指定官方與電視台頻道進行抓取 ===');
  let total = 0;
  for (const ch of TRACKED_CHANNELS) {
    total += await fetchFromChannel(ch);
  }
  console.log(`=== 全部抓取完成！本次共成功收錄 ${total} 部官方及電視台影片 ===`);
}

run();
