import {
  MemberMatchMode,
  MemberName,
  SortOrder,
  VideoGroup,
  VideoItem,
  VideoType
} from '../types';

export const VIDEO_GROUPS: VideoGroup[] = [
  'All',
  'Official Music Videos (MVs)',
  'Shorts & Challenges',
  'Stage Performances',
  'Original Content',
  'Other Official / Semi-official Content'
];

export const ALL_MEMBER_NAMES: MemberName[] = [
  'Carmen',
  'Jiwoo',
  'Yuha',
  'Stella',
  'Juun',
  'A-na',
  'Ian',
  'Ye-on'
];

const MEMBER_ALIAS_MAP: Record<string, MemberName> = {
  carmen: 'Carmen',
  '카르멘': 'Carmen',
  jiwoo: 'Jiwoo',
  '지우': 'Jiwoo',
  yuha: 'Yuha',
  '유하': 'Yuha',
  stella: 'Stella',
  '스텔라': 'Stella',
  juun: 'Juun',
  '준': 'Juun',
  'a-na': 'A-na',
  ana: 'A-na',
  '에이나': 'A-na',
  '아나': 'A-na',
  ian: 'Ian',
  '이안': 'Ian',
  'ye-on': 'Ye-on',
  yeon: 'Ye-on',
  '예온': 'Ye-on'
};

// 嚴格正則表達式：避免英文短字 (例如 ana / ian) 誤判其他英文字，或韓文 준 誤判 준비
const MEMBER_DETECT_RULES: { member: MemberName; patterns: RegExp[] }[] = [
  { member: 'Carmen', patterns: [/\bcarmen\b/i, /카르멘/] },
  { member: 'Jiwoo', patterns: [/\bjiwoo\b/i, /지우/] },
  { member: 'Yuha', patterns: [/\byuha\b/i, /유하/] },
  { member: 'Stella', patterns: [/\bstella\b/i, /스텔라/] },
  { member: 'Juun', patterns: [/\bjuun\b/i, /(?<![가-힣])준(?![가-힣])/] },
  { member: 'A-na', patterns: [/\ba-na\b/i, /\bana\b/i, /에이나/] },
  { member: 'Ian', patterns: [/\bian\b/i, /이안/] },
  { member: 'Ye-on', patterns: [/\bye-on\b/i, /\byeon\b/i, /예온/] }
];

export function detectMembersFromText(text: string = ''): MemberName[] {
  if (!text) return [];
  const found = new Set<MemberName>();
  for (const rule of MEMBER_DETECT_RULES) {
    if (rule.patterns.some(regex => regex.test(text))) {
      found.add(rule.member);
    }
  }
  return Array.from(found);
}

export function isOfficialH2HChannel(channel: string = ''): boolean {
  const c = String(channel || '').trim().toLowerCase();
  return (
    c.includes('hearts2hearts') ||
    c.includes('hearts 2 hearts') ||
    c.includes('하츠투하츠') ||
    c === 'smtown' ||
    c === 'official'
  );
}

export function isOfficialShortsVideo(video: Partial<VideoItem>): boolean {
  const type = String(video?.type || '').toLowerCase();
  const url = String(video?.videoUrl || video?.url || '').toLowerCase();
  const title = String(video?.title || '').toLowerCase();
  const duration = String(video?.duration || '').toLowerCase();
  const category = String(video?.category || '').toLowerCase();

  // 如果時長係幾分鐘嘅正片（例如 03:15），就算簡介有寫 #shorts 都唔當係 Shorts
  const isLongDuration = /^[2-9]:\d{2}|^\d{2}:\d{2}/.test(duration);
  if (isLongDuration && !url.includes('/shorts/')) {
    return false;
  }

  return (
    type === 'shorts' ||
    url.includes('/shorts/') ||
    title.includes('#shorts') ||
    /\bshorts\b/i.test(title) ||
    title.includes('challenge') ||
    title.includes('챌린지') ||
    duration === 'shorts' ||
    category === 'shorts' ||
    category === 'shorts & challenges'
  );
}

// 高精準度 5 大分類引擎
export function getVideoGroup(video: Partial<VideoItem>): VideoGroup {
  const title = String(video?.title || '').toLowerCase();
  const desc = String(video?.description || '').toLowerCase();
  const channel = String(video?.channel || '').toLowerCase();
  const rawType = String(video?.type || '').toLowerCase();
  const rawCat = String(video?.category || '');

  // 1. 最優先檢查 Shorts & Challenges
  if (isOfficialShortsVideo(video) || (desc.includes('#shorts') && !title.includes('mv') && !title.includes('stage'))) {
    return 'Shorts & Challenges';
  }

  // 2. Official Music Videos (MVs) (嚴格排除 Teaser / Behind / Reaction / Fancam / Stage)
  const isNotPureMv =
    /(teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버|fancam|직캠|facecam|페이스캠|stage|inkigayo|인기가요|뮤직뱅크|음악중심|엠카운트다운|dance practice|안무)/i.test(
      title
    );

  if (
    !isNotPureMv &&
    (rawType === 'mv' ||
      /\bmv\b/i.test(title) ||
      title.includes('m/v') ||
      title.includes('music video') ||
      title.includes('뮤직비디오') ||
      rawCat === 'Official Music Videos (MVs)')
  ) {
    return 'Official Music Videos (MVs)';
  }

  // 3. Stage Performances (打歌舞台、直拍 Fancam、Facecam、Dance Practice、Showcase、Concert)
  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live)/i.test(
      channel
    );
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠|가요대전|무대)/i.test(
      title
    );
  const isBehindOrVlog = /(behind|비하인드|making|메이킹|vlog|브이로그)/i.test(title);

  if (!isBehindOrVlog && (rawType === 'stage' || isStageChannel || isStageTitle)) {
    return 'Stage Performances';
  }

  // 4. Original Content (Vlog、團綜、真人騷、電台/綜藝節目)
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|jtbcentertainment|sbs entertainment)/i.test(channel);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.\d|\bep\s?\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는 형님|knowing bros|런닝맨|running man|아이돌 인간극장)/i.test(
      title
    );

  if (rawType === 'original' || isVarietyChannel || isOriginalTitle) {
    return 'Original Content';
  }

  // 5. Other Official / Semi-official Content (Teasers, Behind-the-scenes, Interviews, Covers, Lyrics, etc.)
  return 'Other Official / Semi-official Content';
}

// 精準成員正規化：優先檢查標題，解決「單人直拍被標成全體 8 人」的問題！
export function normalizeMembers(
  rawMembers: unknown,
  title: string = '',
  description: string = ''
): MemberName[] {
  // 第一優先：檢查影片「標題 (Title)」有冇明確寫出特定成員名（例如 직캠 / 個人預告 / 小分隊 Challenge）
  const titleDetected = detectMembersFromText(title);
  if (titleDetected.length > 0 && titleDetected.length < ALL_MEMBER_NAMES.length) {
    return titleDetected;
  }

  // 第二優先：讀取資料庫傳入的 members 陣列（如果唔係全體 8 人預設值，代表有特定成員）
  const fromArray = new Set<MemberName>();
  if (Array.isArray(rawMembers)) {
    for (const m of rawMembers) {
      const key = String(m || '').trim().toLowerCase();
      if (MEMBER_ALIAS_MAP[key]) {
        fromArray.add(MEMBER_ALIAS_MAP[key]);
      }
    }
  }

  if (fromArray.size > 0 && fromArray.size < ALL_MEMBER_NAMES.length) {
    return Array.from(fromArray);
  }

  // 第三優先：檢查簡介嘅前 200 字（避免簡介最底部的全團宣傳 Hashtag 污染單人片）
  const shortDesc = String(description || '').slice(0, 200);
  const descDetected = detectMembersFromText(`${title} ${shortDesc}`);
  if (descDetected.length > 0 && descDetected.length < ALL_MEMBER_NAMES.length) {
    return descDetected;
  }

  // 如果都冇特別指明單一成員，代表係全體 8 人團體片
  return ALL_MEMBER_NAMES;
}

export const inferVideoMembers = normalizeMembers;

export function extractYouTubeId(url: string = ''): string | null {
  const match = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function mapSupabaseRowToVideoItem(row: any): VideoItem {
  const title = row?.title || 'Untitled Video';
  const description = row?.description || '';
  const channel = row?.channel || 'Hearts2Hearts';
  const videoUrl = row?.url || row?.videoUrl || '';
  const ytId = extractYouTubeId(videoUrl);
  const fallbackThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
  const thumbnailUrl = row?.thumbnail || row?.thumbnailUrl || fallbackThumb;
  const date = row?.published_at || row?.publishedAt || row?.date || '2025-02-24';

  const partialItem: Partial<VideoItem> = {
    title,
    description,
    channel,
    videoUrl,
    url: videoUrl,
    type: row?.type || 'video',
    category: row?.category || '',
    duration: row?.duration || ''
  };

  const groupLabel = getVideoGroup(partialItem);
  const isShorts = groupLabel === 'Shorts & Challenges';

  return {
    id: String(row?.id || ytId || Math.random()),
    title,
    category: groupLabel,
    date,
    publishedAt: date,
    published_at: date,
    duration: row?.duration || (isShorts ? 'Shorts' : 'Video'),
    thumbnailUrl,
    thumbnail: thumbnailUrl,
    videoUrl,
    url: videoUrl,
    channel,
    type: (row?.type as VideoType) || (isShorts ? 'shorts' : 'video'),
    views: row?.views || channel,
    members: normalizeMembers(row?.members, title, description),
    description
  };
}

export const mapSupabaseRowToVideo = mapSupabaseRowToVideoItem;

/**
 * 精準成員篩選邏輯：
 * - 'ONLY'（或當用戶想搵「只限所選成員」）：影片入面的成員必須「100% 剛好等於」所選成員（不會混入 8 人大隊片！）
 * - 'INCLUDE' / 'AND'（包含所選成員）：影片入面「有齊所選成員」即可（包含小分隊及 8 人大隊片）
 * - 'OR'（任一所選成員）：影片入面有「任何一位所選成員」即可
 */
export function filterVideosByMembers(
  videos: VideoItem[],
  selectedMembers: (MemberName | string)[],
  matchMode: MemberMatchMode = 'INCLUDE'
): VideoItem[] {
  if (!selectedMembers || selectedMembers.length === 0) {
    return videos;
  }

  const normalizedSelected = Array.from(
    new Set(
      selectedMembers.map(m => {
        const key = String(m || '').trim().toLowerCase();
        return MEMBER_ALIAS_MAP[key] || (m as MemberName);
      })
    )
  );

  const mode = String(matchMode || 'INCLUDE').trim().toUpperCase();

  return videos.filter(video => {
    const videoMembers = Array.from(
      new Set(
        (video.members || []).map(m => {
          const key = String(m || '').trim().toLowerCase();
          return MEMBER_ALIAS_MAP[key] || (m as MemberName);
        })
      )
    );

    // 1. ONLY 模式（UI 撳 "Only" 掣時傳入 'AND' 或 'ONLY'）：
    // 影片成員數量與名單必須「完全一致」（只限呢幾位成員出場，冇其他人）
    if (mode === 'ONLY' || mode === 'AND') {
      return (
        videoMembers.length === normalizedSelected.length &&
        normalizedSelected.every(m => videoMembers.includes(m))
      );
    }

    // 2. INCLUDE 模式（UI 撳 "Include" 掣時傳入 'OR' 或 'INCLUDE'）：
    // 只要影片包含所選成員（無論係單人、小分隊定 8 人團體片）都顯示！
    return normalizedSelected.every(m => videoMembers.includes(m));
  });
}

export function parseViewsCount(viewsStr: string = ''): number {
  if (!viewsStr) return 0;
  const clean = String(viewsStr).trim().toUpperCase().replace(/,/g, '');
  const match = clean.match(/([\d.]+)\s*([KMB])?/);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  if (isNaN(num)) return 0;

  const unit = match[2];
  if (unit === 'B') return num * 1_000_000_000;
  if (unit === 'M') return num * 1_000_000;
  if (unit === 'K') return num * 1_000;
  return num;
}

export function sortVideoItems(
  videos: VideoItem[],
  sortOrder: SortOrder = 'newest'
): VideoItem[] {
  const copy = [...videos];
  return copy.sort((a, b) => {
    if (sortOrder === 'popular' || sortOrder === 'views') {
      const viewsDiff = parseViewsCount(b.views) - parseViewsCount(a.views);
      if (viewsDiff !== 0) return viewsDiff;
    }

    const timeA = new Date(a.date || a.publishedAt || a.published_at || 0).getTime();
    const timeB = new Date(b.date || b.publishedAt || b.published_at || 0).getTime();

    return sortOrder === 'oldest' ? timeA - timeB : timeB - timeA;
  });
}
