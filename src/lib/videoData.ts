/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  MemberMatchMode,
  MemberName,
  SortOrder,
  VideoCategory,
  VideoGroup,
  VideoItem,
  VideoType,
} from '../types';

export const VALID_MEMBERS: MemberName[] = [
  'Carmen',
  'Jiwoo',
  'Yuha',
  'Stella',
  'Juun',
  'A-na',
  'Ian',
  'Ye-on',
];

export const ALL_MEMBER_NAMES: MemberName[] = VALID_MEMBERS;

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
  'a_na': 'A-na',
  ian: 'Ian',
  '이안': 'Ian',
  'ye-on': 'Ye-on',
  yeon: 'Ye-on',
  'ye_on': 'Ye-on',
  '예온': 'Ye-on',
};

export function normalizeMemberName(name: unknown): MemberName | null {
  if (typeof name !== 'string') return null;
  const clean = name.trim().toLowerCase();
  return MEMBER_ALIAS_MAP[clean] || null;
}

export function normalizeMembers(
  rawMembers: unknown,
  title: string = '',
  description: string = ''
): MemberName[] {
  const matched = new Set<MemberName>();

  if (Array.isArray(rawMembers)) {
    for (const m of rawMembers) {
      const normalized = normalizeMemberName(m);
      if (normalized) {
        matched.add(normalized);
      }
    }
  }

  // If no members directly specified or all members, inspect text
  if (matched.size === 0) {
    const text = `${title} ${description}`.toLowerCase();
    if (/\bcarmen\b/i.test(text) || /카르멘/.test(text)) matched.add('Carmen');
    if (/\bjiwoo\b/i.test(text) || /지우/.test(text)) matched.add('Jiwoo');
    if (/\byuha\b/i.test(text) || /유하/.test(text)) matched.add('Yuha');
    if (/\bstella\b/i.test(text) || /스텔라/.test(text)) matched.add('Stella');
    if (/\bjuun\b/i.test(text) || /(?<![가-힣])준(?![가-힣])/.test(text)) matched.add('Juun');
    if (/\ba[-_]?na\b/i.test(text) || /에이나/.test(text) || /아나/.test(text)) matched.add('A-na');
    if (/\bian\b/i.test(text) || /이안/.test(text)) matched.add('Ian');
    if (/\bye[-_]?on\b/i.test(text) || /예온/.test(text)) matched.add('Ye-on');
  }

  return Array.from(matched);
}

export const inferVideoMembers = normalizeMembers;

export function extractYouTubeId(url: string = ''): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function isOfficialH2HChannel(channel: string = ''): boolean {
  const c = String(channel || '').trim().toLowerCase();
  return (
    c.includes('hearts2hearts') ||
    c.includes('hearts 2 hearts') ||
    c.includes('하츠투하츠') ||
    c.includes('h2h') ||
    c === 'smtown' ||
    c === 'official' ||
    c.includes('官方')
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
    title.includes('#hearts2hearts') ||
    title.includes('#하츠투하츠') ||
    title.includes('#h2h') ||
    title.includes('challenge') ||
    title.includes('챌린지') ||
    title.includes('手勢') ||
    duration === 'shorts' ||
    category === 'shorts'
  );
}

/**
 * 4 distinct groups for tests and categorization:
 * 1. official: Official Hearts2Hearts channel long-form videos
 * 2. shorts: Official Shorts
 * 3. stage: Stage Performances & Fancams
 * 4. others: External channels & varieties
 */
export function getVideoGroup(video: Partial<VideoItem>): VideoGroup {
  const channel = String(video?.channel || '').toLowerCase();
  const title = String(video?.title || '').toLowerCase();
  const isH2H = isOfficialH2HChannel(channel);

  if (isH2H) {
    if (isOfficialShortsVideo(video)) {
      return 'shorts';
    }
    return 'official';
  }

  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live|m2)/i.test(
      channel
    );
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|music bank|음악중심|music core|엠카운트다운|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠|be original|relay dance|접력무|接力舞)/i.test(
      title
    );

  if (isStageChannel || isStageTitle) {
    return 'stage';
  }

  return 'others';
}

/**
 * Classify videos into the 5 core user categories:
 * 1. mv: Official Music Videos (MVs)
 * 2. shorts: Shorts & Challenges
 * 3. stage: Stage Performances (Music shows + Concerts + Special stages)
 * 4. original: Original Content (Vlogs, reality series, self-produced content)
 * 5. other: Other Official / Semi-official Content (Behind-the-scenes, interviews, covers, lyric videos, teasers)
 */
export function classifyVideoGenre(
  title: string = '',
  description: string = '',
  channel: string = '',
  url: string = '',
  type: string = ''
): 'mv' | 'shorts' | 'stage' | 'original' | 'other' {
  const t = String(title || '').toLowerCase();
  const d = String(description || '').toLowerCase();
  const c = String(channel || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  const tp = String(type || '').toLowerCase();

  // 1. Teaser, behind, making, unboxing, interview, covers, lyrics are 'other' (even if title contains MV)
  const isTeaserOrBehind =
    /(teaser|티저|trailer|트레일러|behind|비하인드|bh2nd|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버|greeting|인사)/i.test(
      t
    );

  if (isTeaserOrBehind) {
    return 'other';
  }

  // 2. Shorts & Challenges
  const isShorts =
    tp === 'shorts' ||
    u.includes('/shorts/') ||
    t.includes('#shorts') ||
    d.includes('#shorts') ||
    t.includes('challenge') ||
    t.includes('챌린지') ||
    t.includes('手勢') ||
    (t.includes('#hearts2hearts') && t.includes('#h2h')) ||
    (t.includes('#하츠투하츠') && t.includes('#h2h'));

  if (isShorts) {
    return 'shorts';
  }

  // 3. Official Music Videos (MVs)
  const isMvTitle =
    tp === 'mv' ||
    (/\bmv\b/i.test(t) ||
      t.includes('m/v') ||
      t.includes('music video') ||
      t.includes('뮤직비디오') ||
      t.includes('official video') ||
      t.includes('track video'));

  if (isMvTitle) {
    return 'mv';
  }

  // 4. Stage Performances (Music shows, concerts, fancams, special stages)
  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live|m2)/i.test(
      c
    );
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|music bank|음악중심|music core|엠카운트다운|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠|be original|가요대전)/i.test(
      t
    );

  if (tp === 'stage' || isStageChannel || isStageTitle) {
    return 'stage';
  }

  // 5. Original Content (Vlogs, reality, self-produced)
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|running man|jtbcentertainment)/i.test(c);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.|\bepisode\b|둘셋하투하|자컨|reality|리얼리티|diary|다이어리|아는 형님|knowing bros|런닝맨|running man|아이돌 인간극장)/i.test(
      t
    );

  if (tp === 'original' || isVarietyChannel || isOriginalTitle) {
    return 'original';
  }

  // 6. Default to other
  return 'other';
}

export const FIVE_CATEGORIES: Record<
  string,
  {
    id: 'mv' | 'shorts' | 'stage' | 'original' | 'other';
    label: string;
    englishLabel: string;
    shortLabel: string;
    description: string;
  }
> = {
  mv: {
    id: 'mv',
    label: '官方 MV',
    englishLabel: 'Official Music Videos (MVs)',
    shortLabel: 'MV',
    description: 'Official Music Videos',
  },
  shorts: {
    id: 'shorts',
    label: 'Shorts & 挑戰',
    englishLabel: 'Shorts & Challenges',
    shortLabel: 'Shorts',
    description: 'Shorts & Challenges',
  },
  stage: {
    id: 'stage',
    label: '舞台表演',
    englishLabel: 'Stage Performances',
    shortLabel: '舞台',
    description: 'Music shows, concerts & special stages',
  },
  original: {
    id: 'original',
    label: '自製團綜',
    englishLabel: 'Original Content',
    shortLabel: '團綜',
    description: 'Vlogs, reality series & self-produced content',
  },
  other: {
    id: 'other',
    label: '其他影音',
    englishLabel: 'Other Official / Semi-official Content',
    shortLabel: '其他',
    description: 'Behind-the-scenes, interviews, covers, lyric videos, teasers',
  },
};

export const VIDEO_GROUPS: Record<
  string,
  {
    id: string;
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  all: {
    id: 'all',
    label: '全部影片',
    shortLabel: '全部',
    description: '顯示所有影片',
  },
  mv: {
    id: 'mv',
    label: '官方 MV',
    shortLabel: 'MV',
    description: 'Official Music Videos',
  },
  shorts: {
    id: 'shorts',
    label: 'Shorts & 挑戰',
    shortLabel: 'Shorts',
    description: 'Shorts & Challenges',
  },
  stage: {
    id: 'stage',
    label: '舞台表演',
    shortLabel: '舞台',
    description: 'Stage Performances',
  },
  original: {
    id: 'original',
    label: '自製團綜',
    shortLabel: '團綜',
    description: 'Original Content',
  },
  other: {
    id: 'other',
    label: '其他影音',
    shortLabel: '其他',
    description: 'Other Official / Semi-official Content',
  },
  official: {
    id: 'official',
    label: '官方影片',
    shortLabel: '官方',
    description: 'Official Hearts2Hearts content',
  },
  others: {
    id: 'others',
    label: '外部影音',
    shortLabel: '外部',
    description: 'External channels & varieties',
  },
};

export function parseViewsCount(viewsStr: unknown): number {
  if (typeof viewsStr === 'number') {
    return isNaN(viewsStr) ? 0 : viewsStr;
  }
  if (!viewsStr || typeof viewsStr !== 'string') return 0;
  const clean = viewsStr.trim().replace(/,/g, '');
  if (!clean) return 0;

  const metricMatch = clean.match(/^([\d.]+)\s*([KMB])/i);
  if (metricMatch) {
    const num = parseFloat(metricMatch[1]);
    const unit = metricMatch[2].toUpperCase();
    if (unit === 'B') return Math.round(num * 1_000_000_000);
    if (unit === 'M') return Math.round(num * 1_000_000);
    if (unit === 'K') return Math.round(num * 1_000);
  }

  const digitsMatch = clean.match(/(\d+)/);
  if (digitsMatch) {
    return parseInt(digitsMatch[1], 10) || 0;
  }

  return 0;
}

export function sortVideoItems(
  videos: VideoItem[],
  sortOrder: SortOrder = 'new'
): VideoItem[] {
  const copy = [...videos];
  return copy.sort((a, b) => {
    if (sortOrder === 'popular' || sortOrder === 'views') {
      const viewsA = a.viewsCount ?? parseViewsCount(a.views);
      const viewsB = b.viewsCount ?? parseViewsCount(b.views);
      if (viewsB !== viewsA) return viewsB - viewsA;
    }

    const dateA = a.publishedAt || a.published_at || a.date || '';
    const dateB = b.publishedAt || b.published_at || b.date || '';
    const timeA = dateA ? new Date(dateA).getTime() : 0;
    const timeB = dateB ? new Date(dateB).getTime() : 0;

    if (sortOrder === 'old' || sortOrder === 'oldest') {
      return timeA - timeB;
    }
    return timeB - timeA;
  });
}

export function filterVideosByMembers(
  videos: VideoItem[],
  selectedMembers: (MemberName | string)[],
  matchMode: MemberMatchMode = 'including'
): VideoItem[] {
  if (!selectedMembers || selectedMembers.length === 0) {
    return videos;
  }

  const normalizedSelected = selectedMembers
    .map(normalizeMemberName)
    .filter(Boolean) as MemberName[];

  if (normalizedSelected.length === 0) {
    return videos;
  }

  const mode = String(matchMode).toLowerCase();

  return videos.filter((video) => {
    const videoMembers = (video.members || [])
      .map(normalizeMemberName)
      .filter(Boolean) as MemberName[];

    if (mode === 'only') {
      if (videoMembers.length !== normalizedSelected.length) {
        return false;
      }
      return normalizedSelected.every((m) => videoMembers.includes(m));
    }

    return normalizedSelected.every((m) => videoMembers.includes(m));
  });
}

export function mapSupabaseRowToVideoItem(row: any): VideoItem {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('Invalid row data');
  }

  // Type validation
  if (row.type !== undefined && row.type !== null && row.type !== '') {
    const validTypes = ['video', 'shorts', 'mv', 'stage', 'original', 'other'];
    if (!validTypes.includes(row.type)) {
      throw new Error('Invalid type: ' + row.type);
    }
  }

  // URL / YouTube identity validation
  const rawUrl =
    typeof row.url === 'string'
      ? row.url
      : typeof row.videoUrl === 'string'
      ? row.videoUrl
      : undefined;

  if (rawUrl) {
    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const validHosts = [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtu.be',
        'img.youtube.com',
        'i.ytimg.com',
      ];
      if (!validHosts.includes(host)) {
        throw new Error('Invalid YouTube identity or playback host: ' + host);
      }
    } catch (err: any) {
      if (err?.message?.includes('YouTube identity')) throw err;
      throw new Error('Invalid YouTube identity or URL: ' + rawUrl);
    }
  }

  // Date validation
  const rawDate =
    typeof row.published_at === 'string'
      ? row.published_at
      : typeof row.publishedAt === 'string'
      ? row.publishedAt
      : typeof row.date === 'string'
      ? row.date
      : undefined;

  if (rawDate) {
    const dMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dMatch) {
      const y = parseInt(dMatch[1], 10);
      const m = parseInt(dMatch[2], 10) - 1;
      const d = parseInt(dMatch[3], 10);
      const check = new Date(Date.UTC(y, m, d));
      if (
        check.getUTCFullYear() !== y ||
        check.getUTCMonth() !== m ||
        check.getUTCDate() !== d
      ) {
        throw new Error('Invalid calendar date: ' + rawDate);
      }
    }
    if (isNaN(Date.parse(rawDate))) {
      throw new Error('Invalid date: ' + rawDate);
    }
  }

  // Members validation
  let rawMembers = row.members;
  if (typeof rawMembers === 'string') {
    try {
      rawMembers = JSON.parse(rawMembers);
    } catch {
      throw new Error('Invalid members JSON format');
    }
  }
  if (
    rawMembers !== undefined &&
    rawMembers !== null &&
    !Array.isArray(rawMembers)
  ) {
    throw new Error('Invalid members format');
  }

  const ytId =
    extractYouTubeId(rawUrl) ||
    (typeof row.youtube_id === 'string'
      ? row.youtube_id
      : typeof row.youtubeId === 'string'
      ? row.youtubeId
      : undefined);

  const title = typeof row.title === 'string' ? row.title : '';
  const description = typeof row.description === 'string' ? row.description : '';
  const channel = typeof row.channel === 'string' ? row.channel : 'Hearts2Hearts';

  const fallbackThumb = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : '';
  const thumbnailUrl =
    typeof row.thumbnail_url === 'string'
      ? row.thumbnail_url
      : typeof row.thumbnail === 'string'
      ? row.thumbnail
      : typeof row.thumbnailUrl === 'string'
      ? row.thumbnailUrl
      : fallbackThumb;

  const publishedAt = rawDate
    ? rawDate.includes('T')
      ? rawDate.split('T')[0]
      : rawDate
    : '';

  const duration = typeof row.duration === 'string' ? row.duration : '未提供';
  const id = String(row.id ?? ytId ?? Math.random().toString(36).slice(2));

  const members = normalizeMembers(rawMembers, title, description);
  const genre = classifyVideoGenre(title, description, channel, rawUrl, row.type);
  const group = getVideoGroup({ title, description, channel, url: rawUrl, type: row.type });

  return {
    id,
    title,
    category: typeof row.category === 'string' ? row.category : 'all',
    date: publishedAt,
    publishedAt,
    published_at: publishedAt,
    duration,
    thumbnailUrl,
    thumbnail: thumbnailUrl,
    videoUrl: rawUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : undefined),
    url: rawUrl,
    youtubeId: ytId,
    channel,
    type: (row.type as VideoType) || (group === 'shorts' ? 'shorts' : 'video'),
    views: typeof row.views === 'string' ? row.views : '',
    viewsCount: typeof row.viewsCount === 'number' ? row.viewsCount : parseViewsCount(row.views),
    members,
    description,
    group,
    genre,
    isSample: Boolean(row.isSample),
    highlightNote:
      typeof row.highlight_note === 'string'
        ? row.highlight_note
        : typeof row.highlightNote === 'string'
        ? row.highlightNote
        : undefined,
  };
}

export const mapSupabaseRowToVideo = mapSupabaseRowToVideoItem;
