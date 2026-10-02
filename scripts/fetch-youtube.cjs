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

// 嚴格追蹤的 13 個官方與授權電視台頻道名單
const CHANNEL_CONFIG = [
  { name: 'Hearts2Hearts Official', handle: '@hearts2hearts.official', isOfficialMain: true },
  { name: 'SBSKPOP X INKIGAYO', handle: '@SBSKPOP', isOfficialMain: false },
  { name: 'SBSKPOP ZOOM', handle: '@SBSKPOP_ZOOM', isOfficialMain: false },
  { name: 'KBS Kpop', handle: '@KBSKpop', isOfficialMain: false },
  { name: 'MBCkpop', handle: '@MBCkpop', isOfficialMain: false },
  { name: 'Mnet K-POP', handle: '@mnet', isOfficialMain: false },
  { name: 'THE K-POP', handle: '@thekpop', isOfficialMain: false },
  { name: 'ALL THE K-POP', handle: '@allthekpop', isOfficialMain: false },
  { name: 'STUDIO CHOOM', handle: '@STUDIOCHOOM', isOfficialMain: false },
  { name: 'Knowingbros', handle: '@knowingbros', isOfficialMain: false },
  { name: 'JTBC Entertainment', handle: '@jtbcentertainment', isOfficialMain: false },
  { name: '런닝맨 - 스브스 공식 채널', channelId: 'UCaKod3X1Tn4c7Ci0iUKcvzQ', isOfficialMain: false },
  { name: 'SBS Entertainment', handle: '@SBSenter.official', isOfficialMain: false }
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

async function fetchVideosForSource(source) {
  console.log(`\n🔍 正在掃描頻道: ${source.name}...`);

  let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&order=date&type=video&key=${YOUTUBE_API_KEY}`;

  if (source.isOfficialMain) {
    searchUrl += `&q=${encodeURIComponent(source.handle + ' Hearts2Hearts')}`;
  } else if (source.channelId) {
    searchUrl += `&channelId=${source.channelId}&q=${encodeURIComponent('Hearts2Hearts')}`;
  } else {
    searchUrl += `&q=${encodeURIComponent(source.handle + ' Hearts2Hearts')}`;
  }

  try {
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.error) {
      console.error(`⚠️ ${source.name} 查詢出錯:`, data.error.message);
      return 0;
    }

    if (!data.items || data.items.length === 0) {
      console.log(`ℹ️ ${source.name} 未找到新影片`);
      return 0;
    }

    let inserted = 0;

    for (const item of data.items) {
      const videoId = item.id?.videoId;
      if (!videoId || typeof videoId !== 'string' || videoId.length < 5) continue;

      const title = item.snippet?.title || '';
      const desc = item.snippet?.description || '';
      const publishedAt = (item.snippet?.publishedAt || '').split('T')[0] || '2026-10-01';
      const channelTitle = item.snippet?.channelTitle || source.name;

      // 嚴格非官方過濾：若非主頻道，標題或簡介必須實質提及團體名或成員名
      const fullText = (title + ' ' + desc).toLowerCase();
      const hasGroup = fullText.includes('hearts2hearts') || fullText.includes('하츠투하츠') || fullText.includes('h2h');
      const hasMember = Object.values(MEMBER_MAP).flat().some(alias => fullText.includes(alias));

      if (!source.isOfficialMain && !hasGroup && !hasMember) {
        continue;
      }

      // 生成 YouTube 官方標準高畫質縮圖
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
          channel: channelTitle,
          type,
          published_at: publishedAt,
          members: members
        });

        if (insertErr) {
          console.error(`❌ 入庫失敗 [${title}]:`, insertErr.message);
        } else {
          inserted++;
          console.log(`🎉 成功入庫: [${channelTitle}] ${title}`);
          console.log(`   🔗 網址: ${videoUrl}`);
          console.log(`   👥 成員: [${members.join(', ')}]`);
        }
      } else {
        console.log(`⏭️ 已存在跳過: ${title}`);
      }
    }
    return inserted;
  } catch (err) {
    console.error(`❌ 連線錯誤 (${source.name}):`, err.message);
    return 0;
  }
}

async function run() {
  console.log('=== [1] 開始針對 13 個指定官方及節目頻道進行掃描 ===');
  let grandTotal = 0;

  for (const source of CHANNEL_CONFIG) {
    const count = await fetchVideosForSource(source);
    grandTotal += count;
  }

  console.log('\n==================================================');
  console.log(`=== [2] 掃描完成！本次共收錄 ${grandTotal} 條指定官方頻道新影片 ===`);
  console.log('==================================================');
}

run();
