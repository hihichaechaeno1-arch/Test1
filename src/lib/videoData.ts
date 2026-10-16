import { MemberId, Video, VideoCategory } from '../types';
import { VIDEOS } from '../data/h2hData';
import { supabase } from './supabase';

export const VIDEOS_PER_PAGE = 12;

// 你指定的 5 大官方分類完整名稱
export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  mv: 'Official Music Videos (MVs)',
  shorts: 'Shorts & Challenges',
  stage: 'Stage Performances',
  original: 'Original Content',
  other: 'Other Official / Semi-official Content'
};

export const ORDERED_CATEGORIES = [
  'All',
  CATEGORY_LABELS.mv,
  CATEGORY_LABELS.shorts,
  CATEGORY_LABELS.stage,
  CATEGORY_LABELS.original,
  CATEGORY_LABELS.other
];

// 智能判斷影片屬於 5 大類別中的哪一類
export function classifyVideoGenre(
  title: string = '',
  description: string = '',
  channel: string = '',
  url: string = '',
  rawType: string = ''
): VideoCategory {
  const t = String(title || '').toLowerCase();
  const d = String(description || '').toLowerCase();
  const c = String(channel || '').toLowerCase();
  const u = String(url || '').toLowerCase();
  const rt = String(rawType || '').toLowerCase();

  if (rt === 'mv' || rt === 'stage' || rt === 'original' || rt === 'other') {
    return rt as VideoCategory;
  }

  // 1. Shorts & Challenges
  if (
    rt === 'shorts' ||
    u.includes('/shorts/') ||
    t.includes('#shorts') ||
    /\bshorts\b/i.test(t) ||
    t.includes('challenge') ||
    t.includes('챌린지') ||
    d.includes('#shorts')
  ) {
    return 'shorts';
  }

  // 2. Official Music Videos (MVs)
  const isTeaserOrBehind =
    /(teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버)/i.test(t);

  if (
    !isTeaserOrBehind &&
    (/\bmv\b/i.test(t) ||
      t.includes('m/v') ||
      t.includes('music video') ||
      t.includes('뮤직비디오') ||
      t.includes('official video') ||
      t.includes('track video'))
  ) {
    return 'mv';
  }

  // 3. Stage Performances
  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live)/i.test(c);
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠)/i.test(t);

  if (isStageChannel || isStageTitle) {
    return 'stage';
  }

  // 4. Original Content
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|jtbcentertainment|sbs entertainment)/i.test(c);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는 형님|knowing bros|런닝맨|running man|아이돌 인간극장)/i.test(t);

  if (isVarietyChannel || isOriginalTitle) {
    return 'original';
  }

  // 5. Other Official / Semi-official Content
  return 'other';
}

export function inferVideoCategory(row: any): string {
  const genre = classifyVideoGenre(
    row?.title,
    row?.description,
    row?.channel,
    row?.url || row?.videoUrl,
    row?.type || row?.category
  );
  return CATEGORY_LABELS[genre];
}

const NAME_TO_ID: Record<string, MemberId> = {
  carmen: 'carmen',
  '카르멘': 'carmen',
  jiwoo: 'jiwoo',
  '지우': 'jiwoo',
  yuha: 'yuha',
  '유하': 'yuha',
  stella: 'stella',
  '스텔라': 'stella',
  juun: 'juun',
  '준': 'juun',
  'a-na': 'ana',
  ana: 'ana',
  '에이나': 'ana',
  '아나': 'ana',
  ian: 'ian',
  '이안': 'ian',
  'ye-on': 'yeon',
  yeon: 'yeon',
  '예온': 'yeon'
};

const ALL_MEMBER_IDS: MemberId[] = [
  'carmen',
  'jiwoo',
  'yuha',
  'stella',
  'juun',
  'ana',
  'ian',
  'yeon'
];

export function normalizeMembers(rawMembers: unknown, title = '', description = ''): MemberId[] {
  const result = new Set<MemberId>();

  if (Array.isArray(rawMembers)) {
    for (const item of rawMembers) {
      const key = String(item || '').trim().toLowerCase();
      if (NAME_TO_ID[key]) {
        result.add(NAME_TO_ID[key]);
      }
    }
  }

  if (result.size === 0 || result.size === ALL_MEMBER_IDS.length) {
    const text = `${title} ${description}`;
    const detected = new Set<MemberId>();
    if (/\bcarmen\b/i.test(text) || /카르멘/.test(text)) detected.add('carmen');
    if (/\bjiwoo\b/i.test(text) || /지우/.test(text)) detected.add('jiwoo');
    if (/\byuha\b/i.test(text) || /유하/.test(text)) detected.add('yuha');
    if (/\bstella\b/i.test(text) || /스텔라/.test(text)) detected.add('stella');
    if (/\bjuun\b/i.test(text) || /(?<![가-힣])준(?![가-힣])/.test(text)) detected.add('juun');
    if (/\ba-na\b/i.test(text) || /에이나/.test(text)) detected.add('ana');
    if (/\bian\b/i.test(text) || /이안/.test(text)) detected.add('ian');
    if (/\bye-on\b/i.test(text) || /예온/.test(text)) detected.add('yeon');

    if (detected.size > 0) return Array.from(detected);
  }

  return result.size > 0 ? Array.from(result) : ALL_MEMBER_IDS;
}

export const inferVideoMembers = normalizeMembers;

export function extractYouTubeId(url: string = ''): string | null {
  const match = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function mapSupabaseRowToVideo(row: any): Video {
  const title = row?.title || 'Untitled Video';
  const description = row?.description || '';
  const channel = row?.channel || 'Hearts2Hearts';
  const url = row?.url || row?.videoUrl || '';
  const ytId = extractYouTubeId(url);
  const fallbackThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
  const thumbnail = row?.thumbnail || row?.thumbnailUrl || fallbackThumb;

  const genreType = classifyVideoGenre(title, description, channel, url, row?.type);

  return {
    id: String(row?.id || ytId || Math.random()),
    title,
    url,
    videoUrl: url,
    thumbnail,
    thumbnailUrl: thumbnail,
    channel,
    type: genreType,
    category: CATEGORY_LABELS[genreType],
    published_at: row?.published_at || row?.date || '2025-02-24',
    date: row?.published_at || row?.date || '2025-02-24',
    duration: row?.duration || (genreType === 'shorts' ? 'Shorts' : 'Video'),
    views: row?.views || channel,
    members: normalizeMembers(row?.members, title, description),
    description
  };
}

export const mapSupabaseVideoRow = mapSupabaseRowToVideo;

export function normalizeStaticVideos(videos: Video[] = VIDEOS): Video[] {
  return videos.map(v => {
    const genreType = classifyVideoGenre(v.title, v.description, v.channel, v.videoUrl || v.url, v.type);
    return {
      ...v,
      type: genreType,
      category: CATEGORY_LABELS[genreType]
    };
  });
}

export async function fetchVideosFromSupabase(): Promise<Video[]> {
  try {
    if (!supabase) return normalizeStaticVideos(VIDEOS);
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(2000);

    if (error || !data || data.length === 0) {
      return normalizeStaticVideos(VIDEOS);
    }

    return data.map(mapSupabaseRowToVideo);
  } catch {
    return normalizeStaticVideos(VIDEOS);
  }
}

export async function loadArchiveVideos(): Promise<{
  videos: Video[];
  source: 'supabase' | 'fallback';
  error: string | null;
}> {
  try {
    if (!supabase) {
      return { videos: normalizeStaticVideos(VIDEOS), source: 'fallback', error: null };
    }
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(2000);

    if (error) {
      return { videos: normalizeStaticVideos(VIDEOS), source: 'fallback', error: error.message };
    }

    if (!data || data.length === 0) {
      return { videos: normalizeStaticVideos(VIDEOS), source: 'fallback', error: null };
    }

    return {
      videos: data.map(mapSupabaseRowToVideo),
      source: 'supabase',
      error: null
    };
  } catch (err: any) {
    return {
      videos: normalizeStaticVideos(VIDEOS),
      source: 'fallback',
      error: err?.message || 'Failed to load videos'
    };
  }
}

export function getCategories(_videos?: Video[]): string[] {
  return ORDERED_CATEGORIES;
}

export function filterVideos(
  videos: Video[],
  optionsOrMembers:
    | {
        selectedMembers?: MemberId[];
        selectedCategory?: string;
        searchQuery?: string;
      }
    | MemberId[] = {},
  legacyCategory: string = 'All',
  legacySearch: string = ''
): Video[] {
  const isArrayArg = Array.isArray(optionsOrMembers);
  const selectedMembers = isArrayArg ? optionsOrMembers : optionsOrMembers.selectedMembers || [];
  const selectedCategory = isArrayArg ? legacyCategory : optionsOrMembers.selectedCategory || 'All';
  const searchQuery = isArrayArg ? legacySearch : optionsOrMembers.searchQuery || '';

  const q = String(searchQuery || '').trim().toLowerCase();

  return videos.filter(video => {
    const matchesCategory =
      !selectedCategory ||
      selectedCategory === 'All' ||
      video.category === selectedCategory ||
      CATEGORY_LABELS[video.type as VideoCategory] === selectedCategory;

    const matchesMembers =
      selectedMembers.length === 0 ||
      selectedMembers.every(m => video.members.includes(m));

    const matchesSearch =
      !q ||
      video.title.toLowerCase().includes(q) ||
      (video.channel || '').toLowerCase().includes(q) ||
      (video.description || '').toLowerCase().includes(q) ||
      video.category.toLowerCase().includes(q);

    return matchesCategory && matchesMembers && matchesSearch;
  });
}

export function paginateVideos(
  videos: Video[],
  currentPage: number = 1,
  pageSize: number = VIDEOS_PER_PAGE
): {
  items: Video[];
  videos: Video[];
  paginatedVideos: Video[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
} {
  const totalItems = videos.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize;
  const sliced = videos.slice(start, start + pageSize);

  return {
    items: sliced,
    videos: sliced,
    paginatedVideos: sliced,
    currentPage: safePage,
    totalPages,
    totalItems,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1
  };
}
