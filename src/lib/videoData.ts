import {
  MemberMatchMode,
  MemberName,
  SortOrder,
  VideoGroup,
  VideoItem,
  VideoType
} from '../types';

// 你指定的 5 大分類按鈕清單（App.tsx 會自動讀取呢個陣列生成按鈕！）
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

// 智能將每條影片歸入你指定的 5 大分類
export function getVideoGroup(video: Partial<VideoItem>): VideoGroup {
  const title = String(video?.title || '').toLowerCase();
  const desc = String(video?.description || '').toLowerCase();
  const channel = String(video?.channel || '').toLowerCase();
  const rawType = String(video?.type || '').toLowerCase();
  const rawCat = String(video?.category || '');

  // 如果原本已經係 5 大分類名稱之一，直接返回
  if (
    rawCat === 'Official Music Videos (MVs)' ||
    rawCat === 'Shorts & Challenges' ||
    rawCat === 'Stage Performances' ||
    rawCat === 'Original Content' ||
    rawCat === 'Other Official / Semi-official Content'
  ) {
    return rawCat;
  }

  // 1. Shorts & Challenges
  if (isOfficialShortsVideo(video) || desc.includes('#shorts')) {
    return 'Shorts & Challenges';
  }

  // 2. Official Music Videos (MVs)
  const isTeaserOrBehind =
    /(teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버)/i.test(
      title
    );

  if (
    rawType === 'mv' ||
    (!isTeaserOrBehind &&
      (/\bmv\b/i.test(title) ||
        title.includes('m/v') ||
        title.includes('music video') ||
        title.includes('뮤직비디오') ||
        title.includes('official video') ||
        title.includes('track video') ||
        rawCat.toLowerCase() === 'mv'))
  ) {
    return 'Official Music Videos (MVs)';
  }

  // 3. Stage Performances
  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live)/i.test(
      channel
    );
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠)/i.test(
      title
    );

  if (
    rawType === 'stage' ||
    isStageChannel ||
    isStageTitle ||
    rawCat.toLowerCase() === 'stage' ||
    rawCat.toLowerCase() === 'performance' ||
    rawCat.toLowerCase() === 'dance practice'
  ) {
    return 'Stage Performances';
  }

  // 4. Original Content
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|jtbcentertainment|sbs entertainment)/i.test(channel);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는 형님|knowing bros|런닝맨|running man|아이돌 인간극장)/i.test(
      title
    );

  if (
    rawType === 'original' ||
    isVarietyChannel ||
    isOriginalTitle ||
    rawCat.toLowerCase() === 'vlog' ||
    rawCat.toLowerCase() === 'variety' ||
    rawCat.toLowerCase() === 'original content'
  ) {
    return 'Original Content';
  }

  // 5. Other Official / Semi-official Content
  return 'Other Official / Semi-official Content';
}

export function normalizeMembers(
  rawMembers: unknown,
  title: string = '',
  description: string = ''
): MemberName[] {
  const matched = new Set<MemberName>();

  if (Array.isArray(rawMembers)) {
    for (const m of rawMembers) {
      const key = String(m || '').trim().toLowerCase();
      if (MEMBER_ALIAS_MAP[key]) {
        matched.add(MEMBER_ALIAS_MAP[key]);
      }
    }
  }

  if (matched.size === 0 || matched.size === ALL_MEMBER_NAMES.length) {
    const text = `${title} ${description}`;
    const detected = new Set<MemberName>();
    if (/\bcarmen\b/i.test(text) || /카르멘/.test(text)) detected.add('Carmen');
    if (/\bjiwoo\b/i.test(text) || /지우/.test(text)) detected.add('Jiwoo');
    if (/\byuha\b/i.test(text) || /유하/.test(text)) detected.add('Yuha');
    if (/\bstella\b/i.test(text) || /스텔라/.test(text)) detected.add('Stella');
    if (/\bjuun\b/i.test(text) || /(?<![가-힣])준(?![가-힣])/.test(text)) detected.add('Juun');
    if (/\ba-na\b/i.test(text) || /에이나/.test(text)) detected.add('A-na');
    if (/\bian\b/i.test(text) || /이안/.test(text)) detected.add('Ian');
    if (/\bye-on\b/i.test(text) || /예온/.test(text)) detected.add('Ye-on');

    if (detected.size > 0) {
      return Array.from(detected);
    }
  }

  return matched.size > 0 ? Array.from(matched) : ALL_MEMBER_NAMES;
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
    category: row?.category || ''
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

export function filterVideosByMembers(
  videos: VideoItem[],
  selectedMembers: (MemberName | string)[],
  matchMode: MemberMatchMode = 'AND'
): VideoItem[] {
  if (!selectedMembers || selectedMembers.length === 0) {
    return videos;
  }

  const normalizedSelected = selectedMembers.map(m => {
    const key = String(m || '').trim().toLowerCase();
    return MEMBER_ALIAS_MAP[key] || m;
  });

  const mode = String(matchMode || 'AND').toUpperCase();

  return videos.filter(video => {
    const videoMembers = (video.members || []).map(m => {
      const key = String(m || '').trim().toLowerCase();
      return MEMBER_ALIAS_MAP[key] || m;
    });

    if (mode === 'OR') {
      return normalizedSelected.some(m => videoMembers.includes(m));
    }
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
