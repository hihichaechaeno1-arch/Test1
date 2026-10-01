import { createClient } from '@supabase/supabase-js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Hearts2Hearts 官方頻道 ID (若未知可先以搜尋或自訂 Handle 抓取)
// SM 或官方頻道常見 Handle: @Hearts2Hearts
const CHANNEL_HANDLE = 'Hearts2Hearts'; 

// 8 位成員中英文對照字典，用於標題分析
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function detectMembers(text) {
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
  console.log('開始抓取 YouTube 影片...');
  // 透過 YouTube Search API 查詢最近上傳之 15 部影片
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(CHANNEL_HANDLE)}&maxResults=15&order=date&type=video&key=${YOUTUBE_API_KEY}`;
  
  const res = await fetch(searchUrl);
  const data = await res.json();

  if (!data.items) {
    console.error('抓取失敗或無資料:', data);
    return;
  }

  for (const item of data.items) {
    const videoId = item.id.videoId;
    const title = item.snippet.title;
    const publishedAt = item.snippet.publishedAt.split('T')[0];
    const channelTitle = item.snippet.channelTitle;
    const thumbnail = item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url;
    
    // 判斷是否為 Shorts（標題包含 #shorts 或 shorts）
    const isShorts = title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('shorts');
    const type = isShorts ? 'shorts' : 'video';
    const videoUrl = isShorts 
      ? `https://www.youtube.com/shorts/${videoId}` 
      : `https://www.youtube.com/watch?v=${videoId}`;

    const members = detectMembers(title + ' ' + item.snippet.description);

    // 檢查資料庫是否已存在此影片
    const { data: existing } = await supabase
      .from('videos')
      .select('id')
      .eq('url', videoUrl)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('videos').insert({
        title,
        url: videoUrl,
        thumbnail,
        channel: channelTitle,
        type,
        published_at: publishedAt,
        members: members
      });

      if (error) {
        console.error(`寫入失敗: ${title}`, error);
      } else {
        console.log(`✅ 新增成功: ${title} [成員: ${members.join(', ')}]`);
      }
    } else {
      console.log(`已存在跳過: ${title}`);
    }
  }
  console.log('自動同步完成！');
}

run();
