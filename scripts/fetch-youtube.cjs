const { createClient } = require('@supabase/supabase-js');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!YOUTUBE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 缺少必要的環境變數！請檢查 Settings -> Secrets -> Actions');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { autoRefreshToken: false, createClient: () => null }
});

// 8 位成員中英韓關鍵字字典
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

// 13 個官方與電視台的唯一官方 Channel ID 白名單（只接受此 13 個頻道上傳的影片）
const TRACKED_CHANNELS = [
  { name: 'Hearts2Hearts Official', handleQuery: 'Hearts2Hearts Official', isOfficialMain: true },
  { name: 'SBSKPOP X INKIGAYO', channelId: 'UCbdf354nngcR1v3nB9g2Lvg', isOfficialMain: false },
  { name: 'SBSKPOP ZOOM', channelId: 'UCgox_wD1aHq10Pshw4kFh8Q', isOfficialMain: false },
  { name: 'KBS Kpop', channelId: 'UC5BMQOsBh4cmR9-p_gC_4Lw', isOfficialMain: false },
  { name: 'MBCkpop', channelId: 'UC1ovbpL67nKDvgJc_Tf_p-A', isOfficialMain: false },
  { name: 'Mnet K-POP', channelId: 'UCbD8EppRX3ZwJSou-TVoKUw', isOfficialMain: false },
  { name: 'THE K-POP', channelId: 'UCcvqTgm4a3Y1OvdHj1m7L6A', isOfficialMain: false },
  { name: 'ALL THE K-POP', channelId: 'UC_7y9N5W4H5L_7w0f4T6r5w', isOfficialMain: false },
  { name: 'STUDIO CHOOM', channelId: 'UCoHpxO7N2u_xP9Q_m3E6U_A', isOfficialMain: false },
  { name: 'Knowingbros', channelId: 'UCUpJs89f2PmVP8P5n2Q3_3g', isOfficialMain: false },
  { name: 'JTBC Entertainment', channelId: 'UCvG8yZ0O9rT7gY_J7rZ2w1A', isOfficialMain: false },
  { name: '런닝맨 - 스브스 공식 채널', channelId: 'UCaKod3X1Tn4c7Ci0iUKcvzQ', isOfficialMain: false },
  { name: 'SBS Entertainment', channelId: 'UCgB_0L5o2b3tN-H4m0K1vqw', isOfficialMain: false }
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

async function fetchFromChannel(channelInfo) {
  console.log(`\n🔍 正在掃描官方/電視台頻道: ${channelInfo.name}...`);

  let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&order=date&type=video&key=${YOUTUBE_API_KEY}`;

  if (channelInfo.channelId) {
    // 嚴格鎖定 Channel ID：YouTube API 伺服器端強制只在該頻道內部搜尋
    searchUrl += `&channelId=${channelInfo.channelId}&q=${encodeURIComponent('Hearts2Hearts')}`;
  } else {
    // 官方主頻道
    searchUrl += `&q=${encodeURIComponent('Hearts2Hearts Official')}`;
  }

  try {
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.error) {
      console.error(`⚠️ ${channelInfo.name} 查詢出錯:`, data.error.message);
      return 0;
    }

    if (!data.items || data.items.length === 0) {
      console.log(`ℹ️ ${channelInfo.name} 未找到新影片`);
      return 0;
    }

    let inserted = 0;

    for (const item of data.items) {
      const videoId = item.id?.videoId;
      if (!videoId || typeof videoId !== 'string' || videoId.length < 5) continue;

      const title = item.snippet?.title || '';
      const desc = item.snippet?.description || '';
      const publishedAt = (item.snippet?.publishedAt || '').split('T')[0] || '2026-10-01';
      const actualChannelId = item.snippet?.channelId;
      const actualChannelTitle = item.snippet?.channelTitle || channelInfo.name;

      // 【核心防線 1】：若該項目有指定 channelId，上載者的 channelId 必須完全相符！絕不收錄任何路人！
      if (channelInfo.channelId && actualChannelId !== channelInfo.channelId) {
        console.log(`⛔ 跳過非官方路人頻道上載: [${actualChannelTitle}] ${title}`);
        continue;
      }

      // 【核心防線 2】：若為官方主頻道（尚未指定 channelId 前），頻道名稱必須包含 Hearts2Hearts
      if (channelInfo.isOfficialMain) {
        const cLower = actualChannelTitle.toLowerCase();
        if (!cLower.includes('hearts2hearts') && !cLower.includes('hearts 2 hearts')) {
          console.log(`⛔ 跳過非官方頻道: [${actualChannelTitle}]`);
          continue;
        }
      }

      // 【核心防線 3】：電視台節目必須實質提及團名或成員名
      const fullText = (title + ' ' + desc).toLowerCase();
      const hasGroup = fullText.includes('hearts2hearts') || fullText.includes('하츠투하츠') || fullText.includes('h2h');
      const hasMember = Object.values(MEMBER_MAP).flat().some(alias => fullText.includes(alias));

      if (!channelInfo.isOfficialMain && !hasGroup && !hasMember) {
        continue;
      }

      // 產生 YouTube 官方標準高清晰度縮圖
      const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      const isShorts = title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('shorts');
      const type = isShorts ? 'shorts' : 'video';
      const videoUrl = isShorts 
        ? `https://www.youtube.com/shorts/${videoId}` 
        : `https://www.youtube.com/watch?v=${videoId}`;

      const members = detectMembers(fullText);

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
          channel: actualChannelTitle,
          type,
          published_at: publishedAt,
          members: members
        });

        if (insertErr) {
          console.error(`❌ 入庫失敗 [${title}]:`, insertErr.message);
        } else {
          inserted++;
          console.log(`🎉 成功入庫官方正片: [${actualChannelTitle}] ${title}`);
        }
      } else {
        console.log(`⏭️ 已存在跳過: ${title}`);
      }
    }
    return inserted;
  } catch (err) {
    console.error(`❌ 連線錯誤 (${channelInfo.name}):`, err.message);
    return 0;
  }
}

async function run() {
  console.log('=== [1] 開始針對 13 個官方與電視台頻道進行嚴格白名單抓取 ===');
  let grandTotal = 0;

  for (const source of TRACKED_CHANNELS) {
    const count = await fetchFromChannel(source);
    grandTotal += count;
  }

  console.log('\n==================================================');
  console.log(`=== [2] 抓取完成！本次共成功收錄 ${grandTotal} 部名單內官方正片 ===`);
  console.log('==================================================');
}

run();
