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
  'Official MV',
  'Shorts / Challenges',
  'Stage / Performance',
  'Variety Show',
  'Other Video'
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

// 嚴格判斷是否為 Hearts2Hearts 官方帳號
export function isOfficialH2HChannel(channel: string = ''): boolean {
  const c = String(channel || '').trim().toLowerCase();
  return (
    c.includes('hearts2hearts') ||
    c.includes('hearts 2 hearts') ||
    c.includes('하츠투하츠') ||
    c === 'official'
  );
}

export function isOfficialShortsVideo(video: Partial<VideoItem>): boolean {
  const channel = String(video?.channel || '');
  // 必須來自 Hearts2Hearts 官方帳號！
  if (!isOfficialH2HChannel(channel)) {
    return false;
  }

  const type = String(video?.type || '').toLowerCase();
  const url = String(video?.videoUrl || video?.url || '').toLowerCase();
  const title = String(video?.title || '').toLowerCase();
  const desc = String(video?.description || '').toLowerCase();
  const duration = String(video?.duration || '').toLowerCase();
  const category = String(video?.category || '').toLowerCase();

  // 如果明確標記咗超過 2 分鐘嘅長片（例如 03:15），或者係 MV / Vlog / Behind / Commentary，就唔算係 Shorts
  const isLongDuration = /^[2-9]:\d{2}|^\d{2}:\d{2}/.test(duration);
  if (isLongDuration && !url.includes('/shorts/')) {
    return false;
  }

  const isLongFormContent =
    /(\bmv\b|m\/v|music video|뮤직비디오|commentary|코멘터리|behind|비하인드|making|메이킹|vlog|브이로그|dance practice|안무\s*연습|\bep\.\d|\bepisode\b|teaser|티저|trailer)/i.test(
      title
    );
  if (isLongFormContent && !url.includes('/shorts/')) {
    return false;
  }

  return (
    type === 'shorts' ||
    url.includes('/shorts/') ||
    title.includes('#shorts') ||
    /\bshorts\b/i.test(title) ||
    title.includes('challenge') ||
    title.includes('챌린지') ||
    desc.includes('#shorts') ||
    duration === 'shorts' ||
    category === 'shorts' ||
    category === 'shorts / challenges'
  );
}

// 高精準度 5 大分類引擎
export function getVideoGroup(video: Partial<VideoItem>): VideoGroup {
  const title = String(video?.title || '').toLowerCase();
  const channel = String(video?.channel || '').toLowerCase();
  const rawType = String(video?.type || '').toLowerCase();
  const rawCat = String(video?.category || '');

  // 1. Shorts / Challenges：只限 Hearts2Hearts 官方帳號的 Shorts & Challenges！
  if (isOfficialShortsVideo(video)) {
    return 'Shorts / Challenges';
  }

  // 2. Official MV：排除 MV Commentary、Teaser、Behind、Reaction、Stage 等（歸入 Other Video 或 Stage）
  const isNotPureMv =
    /(commentary|코멘터리|teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버|fancam|직캠|facecam|페이스캠|stage|inkigayo|인기가요|뮤직뱅크|음악중심|엠카운트다운|dance practice|안무|cheer guide|응원법)/i.test(
      title
    );

  if (
    !isNotPureMv &&
    (rawType === 'mv' ||
      /\bmv\b/i.test(title) ||
      title.includes('m/v') ||
      title.includes('music video') ||
      title.includes('뮤직비디오') ||
      rawCat === 'Official MV')
  ) {
    return 'Official MV';
  }

  // 3. Stage / Performance：打歌舞台、SBS Entertainment 舞台（如歌謠大戰/人氣歌謠）、直拍、練習室
  const isPureVarietyTitle =
    /(아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|돌박이일|워크돌|동네스타k|스브스뉴스|문명특급|살롱드립|집대성|할명수|리무진서비스)/i.test(
      title
    );

  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live|sbs entertainment)/i.test(
      channel
    );
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠|가요대전|gayo daejeon|무대|더쇼|the show|쇼챔피언|show champion)/i.test(
      title
    );
  const isBehindOrVlog =
    /(behind|비하인드|making|메이킹|vlog|브이로그|commentary|코멘터리|interview|인터뷰)/i.test(title);

  if (!isBehindOrVlog && !isPureVarietyTitle && (rawType === 'stage' || isStageChannel || isStageTitle)) {
    return 'Stage / Performance';
  }

  // 4. Variety Show：綜藝頻道（排除 SBS Entertainment 舞台）或明確綜藝/團綜標題
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|jtbcentertainment)/i.test(channel);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.\d|\bep\s?\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|예능|variety)/i.test(
      title
    );

  if (rawType === 'original' || isVarietyChannel || isOriginalTitle || isPureVarietyTitle) {
    return 'Variety Show';
  }

  // 5. Other Video：包括 MV Commentary、Teasers、Behind-the-scenes、Interviews 等
  return 'Other Video';
}

export function normalizeMembers(
  rawMembers: unknown,
  title: string = '',
  description: string = ''
): MemberName[] {
  const titleDetected = detectMembersFromText(title);
  if (titleDetected.length > 0 && titleDetected.length < ALL_MEMBER_NAMES.length) {
    return titleDetected;
  }

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

  const shortDesc = String(description || '').slice(0, 200);
  const descDetected = detectMembersFromText(`${title} ${shortDesc}`);
  if (descDetected.length > 0 && descDetected.length < ALL_MEMBER_NAMES.length) {
    return descDetected;
  }

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
  const isShorts = groupLabel === 'Shorts / Challenges';

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

  const normalizedSelected = Array.from(
    new Set(
      selectedMembers.map(m => {
        const key = String(m || '').trim().toLowerCase();
        return MEMBER_ALIAS_MAP[key] || (m as MemberName);
      })
    )
  );

  const mode = String(matchMode || 'AND').trim().toUpperCase();

  return videos.filter(video => {
    const videoMembers = Array.from(
      new Set(
        (video.members || []).map(m => {
          const key = String(m || '').trim().toLowerCase();
          return MEMBER_ALIAS_MAP[key] || (m as MemberName);
        })
      )
    );

    if (mode === 'ONLY') {
      return (
        videoMembers.length === normalizedSelected.length &&
        normalizedSelected.every(m => videoMembers.includes(m))
      );
    }

    if (mode === 'OR') {
      return normalizedSelected.some(m => videoMembers.includes(m));
    }

    // 'AND' or 'INCLUDE'
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
