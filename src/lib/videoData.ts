import { MemberId, Video, VideoCategory } from '../types';
import { VIDEOS } from '../data/h2hData';
import { supabase } from './supabase';

// 5 大類別顯示名稱對照表
export const CATEGORY_LABELS: Record<VideoCategory, string> = {
  mv: 'Official MVs',
  shorts: 'Shorts & Challenges',
  stage: 'Stage Performances',
  original: 'Original Content',
  other: 'Other Official Content'
};

// 智能判斷影片屬於 5 大類別中的哪一類
export function classifyVideoGenre(
  title: string = '',
  description: string = '',
  channel: string = '',
  url: string = '',
  rawType: string = ''
): VideoCategory {
  const t = title.toLowerCase();
  const d = description.toLowerCase();
  const c = channel.toLowerCase();
  const u = url.toLowerCase();
  const rt = rawType.toLowerCase();

  // 如果資料庫已經存好 5 大分類代碼，直接採用
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

  // 2. Official Music Videos (MVs) (排除 Teaser、幕後花絮、Reaction)
  const isTeaserOrBehind =
    /(teaser|티저|trailer|트레일러|behind|비하인드|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱)/i.test(t);

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

  // 3. Stage Performances (音樂節目、演唱會、特別舞台、直拍、練習室)
  const isStageChannel =
    /(sbskpop|inkigayo|kbs kpop|mbckpop|mnet|studio choom|the k-pop|all the k-pop|it's live)/i.test(c);
  const isStageTitle =
    /(stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|입덕직캠)/i.test(t);

  if (isStageChannel || isStageTitle) {
    return 'stage';
  }

  // 4. Original Content (Vlogs、團綜、自製內容、大型綜藝)
  const isVarietyChannel =
    /(knowingbros|아는형님|런닝맨|jtbcentertainment|sbs entertainment)/i.test(c);
  const isOriginalTitle =
    /(vlog|브이로그|\bep\.|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|\blog\b|아는 형님|knowing bros|런닝맨|running man|아이돌 인간극장)/i.test(t);

  if (isVarietyChannel || isOriginalTitle) {
    return 'original';
  }

  // 5. Other Official / Semi-official Content (Behind-the-scenes, interviews, covers, lyric videos, teasers, etc.)
  return 'other';
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
    const text = `${title} ${description}`.toLowerCase();
    const detected = new Set<MemberId>();
    for (const [alias, id] of Object.entries(NAME_TO_ID)) {
      if (alias.length <= 3 && /^[a-z]+\$/.test(alias)) {
        if (new RegExp(`\\b${alias}\\b`, 'i').test(text)) detected.add(id);
      } else if (text.includes(alias)) {
        detected.add(id);
      }
    }
    if (detected.size > 0) return Array.from(detected);
  }

  return result.size > 0 ? Array.from(result) : ALL_MEMBER_IDS;
}

export function extractYouTubeId(url: string = ''): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function mapSupabaseRowToVideo(row: any): Video {
  const title = row.title || 'Untitled Video';
  const description = row.description || '';
  const channel = row.channel || 'Hearts2Hearts';
  const url = row.url || row.videoUrl || '';
  const ytId = extractYouTubeId(url);
  const fallbackThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
  const thumbnail = row.thumbnail || row.thumbnailUrl || fallbackThumb;

  const genreType = classifyVideoGenre(title, description, channel, url, row.type);

  return {
    id: String(row.id || ytId || Math.random()),
    title,
    url,
    videoUrl: url,
    thumbnail,
    thumbnailUrl: thumbnail,
    channel,
    type: genreType,
    category: CATEGORY_LABELS[genreType],
    published_at: row.published_at || row.date || '2025-02-24',
    date: row.published_at || row.date || '2025-02-24',
    duration: genreType === 'shorts' ? '0:45' : '3:30',
    views: channel,
    members: normalizeMembers(row.members, title, description),
    description
  };
}

export async function fetchVideosFromSupabase(): Promise<Video[]> {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(2000);

    if (error || !data || data.length === 0) {
      return VIDEOS.map(v => ({
        ...v,
        type: classifyVideoGenre(v.title, v.description, v.channel, v.videoUrl, v.type)
      }));
    }

    return data.map(mapSupabaseRowToVideo);
  } catch {
    return VIDEOS;
  }
}
