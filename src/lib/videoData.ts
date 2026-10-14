/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemberMatchMode, MemberName, SortOrder, VideoCategory, VideoGroup, VideoItem, VideoType } from '../types';

const MEMBER_NAMES: MemberName[] = ['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'];
const CATEGORIES: VideoCategory[] = ['all', 'mv', 'dance', 'vlog', 'variety', 'shorts'];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export interface VideoGroupInfo {
  id: VideoGroup;
  label: string;
  shortLabel: string;
  description: string;
}

export const VIDEO_GROUPS: Record<VideoGroup, VideoGroupInfo> = {
  official: {
    id: 'official',
    label: '官方頻道影片',
    shortLabel: '官方頻道 (MV/綜藝)',
    description: 'Hearts2Hearts 官方頻道發布之 MV、自製綜藝、練習室與 VLOG',
  },
  shorts: {
    id: 'shorts',
    label: '官方 Shorts',
    shortLabel: '官方 Shorts',
    description: 'Hearts2Hearts 官方頻道發布之 9:16 直式短影音、挑戰與短篇花絮',
  },
  stage: {
    id: 'stage',
    label: '舞台與直拍',
    shortLabel: '舞台與直拍',
    description: '打歌節目舞台、個人直拍 (Fancam)、STUDIO CHOOM 與 Live 現場',
  },
  others: {
    id: 'others',
    label: '其他影片',
    shortLabel: '其他影片',
    description: '電視台綜藝出演、網路節目、訪談與非官方頻道影音',
  },
};

/**
 * Check if a channel name indicates the official Hearts2Hearts channel.
 */
export function isOfficialH2HChannel(channelRaw: unknown): boolean {
  const channel = text(channelRaw).toLowerCase();
  if (!channel) return false;
  // Exclude third-party fan accounts, fan translations, or archives
  if (/fanclub|fan club|fansite|fanpage|fancafe|updates|fancam|字幕組|中文首站|飯拍/i.test(channel)) {
    return false;
  }
  return (
    channel.includes('hearts2hearts') ||
    channel.includes('hearts 2 hearts') ||
    channel.includes('하츠투하츠') ||
    /\bh2h\b/i.test(channel) ||
    channel.includes('h2h 官方') ||
    channel.includes('h2h官方') ||
    channel.includes('h2h official')
  );
}

/**
 * Detect whether an official Hearts2Hearts video is long-form (MV, variety episode, behind-the-scenes, recording, jacket)
 * rather than a Short (9:16 challenge, reel, member snippet).
 */
export function isOfficialLongFormVideo(title: string, description: string = ''): boolean {
  const full = `${title} ${description}`.toLowerCase();
  return (
    /\|\s*hearts2hearts/i.test(title) ||
    /\|\s*둘셋하투하/i.test(title) ||
    /\b(mv|m\/v|music video|bh2nd|behind|episode|ep\.\s*\d+|vlog|teaser|trailer|special clip|choreo(?:graphy)?|practice|recording|jacket|promotion event)\b/i.test(title) ||
    /비하인드|뮤직비디오|티저|에피소드|자체\s*예능|다큐/i.test(full)
  );
}

/**
 * Determine whether an official Hearts2Hearts video is a Short.
 * YouTube stores all uploads with type: 'video' unless explicit '#shorts' was written in title.
 * For official Hearts2Hearts channel, any video that is not a long-form MV/variety/behind is an official Short!
 */
export function isOfficialShortsVideo(video: { channel?: string; type?: string; title?: string; description?: string }): boolean {
  if (!isOfficialH2HChannel(video.channel)) return false;
  const type = text(video.type).toLowerCase();
  const title = text(video.title);
  const description = text(video.description);

  if (type === 'shorts' || /#shorts\b/i.test(title) || /【shorts】|\[shorts\]/i.test(title) || /#shorts\b/i.test(description)) {
    return true;
  }

  return !isOfficialLongFormVideo(title, description);
}

/**
 * Classify a video into 1 of 4 groups:
 * 1. official: Official Hearts2Hearts channel videos (MV, official variety shows, dance practices, vlogs)
 * 2. shorts: Official Hearts2Hearts channel shorts (vertical short-form videos from the official channel)
 * 3. stage: Stage performances & fancams (music shows, live stages, direct cams, STUDIO CHOOM, It's Live)
 * 4. others: Variety shows, interviews, and other external appearances / external shorts
 */
export function getVideoGroup(video: {
  channel?: string;
  type?: string;
  title?: string;
  description?: string;
  category?: string;
}): VideoGroup {
  const channel = text(video.channel).toLowerCase();
  const title = text(video.title).toLowerCase();
  const description = text(video.description).toLowerCase();

  const isOfficial = isOfficialH2HChannel(channel);

  // Group 1 & 2: Official channel content - focus purely on shorts
  if (isOfficial) {
    // Shorts from official channel belong to 'shorts'
    if (isOfficialShortsVideo(video)) {
      return 'shorts';
    }
    // Regular videos from official channel belong to 'official' (MV, official variety, dance practices, vlogs)
    return 'official';
  }

  // If not from official channel:
  // Group 3: Stage & Fancam (Music shows, live stages, fancams, relay dance)
  const isStageChannel = /sbskpop|kbs kpop|mbckpop|mnet|the k-pop|thekpop|all the k-pop|allthekpop|studio choom|studiochoom|it's live|m2|music bank|inkigayo|show champion|m countdown|show! music core/i.test(channel);
  const textContent = `${title} ${description}`;
  const isStageKeyword = /直拍|舞台|fancam|stage|live|生唱|現場|직캠|무대|페이스캠|줌캠|fullcam|dance practice|練習室|choreography|relay dance|接力舞|solo stage|合作舞台/i.test(textContent);

  if (isStageChannel || isStageKeyword || video.category === 'dance' || (video.category === 'mv' && !isOfficial)) {
    return 'stage';
  }

  // Group 4: Others (External variety shows, interviews, external shorts, etc.)
  return 'others';
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

/** Accept IDs and known YouTube URL forms, never an arbitrary host's query string. */
export function getYoutubeId(value: unknown): string {
  const raw = text(value);
  if (VIDEO_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    let id = '';
    if (url.hostname === 'youtu.be') {
      id = url.pathname.slice(1);
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch'
        ? url.searchParams.get('v') || ''
        : /^\/(shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[2] || '';
    }
    return VIDEO_ID.test(id) ? id : '';
  } catch {
    return '';
  }
}

function parseMembers(value: unknown): MemberName[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string') {
    if (value.trim().startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) values = parsed;
      } catch {
        throw new Error('Invalid members JSON');
      }
    } else {
      values = value.split(',');
    }
  }
  return [...new Set(values.flatMap((entry) => {
    const name = MEMBER_NAMES.find((member) => member.toLowerCase() === text(entry).toLowerCase());
    return name ? [name] : [];
  }))];
}

function parseDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = raw.split('T')[0];
  if (raw.includes('T') && !Number.isFinite(Date.parse(raw))) throw new Error('Invalid publication timestamp');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid publication date');
  }
  return date;
}

const MEMBER_HASHTAG_MAP: Record<MemberName, RegExp> = {
  Carmen: /#(carmen|카르멘)\b/i,
  Jiwoo: /#(jiwoo|지우)\b/i,
  Yuha: /#(yuha|유하)\b/i,
  Stella: /#(stella|스텔라)\b/i,
  Juun: /#(juun|준)\b/i,
  'A-na': /#(a[-_]?na|아나|에이나)\b/i,
  Ian: /#(ian|이안)\b/i,
  'Ye-on': /#(ye[-_]?on|예온)\b/i,
};

export function inferMembersFromTitle(titleText: string): MemberName[] {
  if (!titleText) return [];
  const found: MemberName[] = [];
  for (const [member, pattern] of Object.entries(MEMBER_HASHTAG_MAP) as [MemberName, RegExp][]) {
    if (pattern.test(titleText)) {
      found.push(member);
    }
  }
  return found;
}

/** Explicit legacy adapter: importer url/thumbnail and canonical fields are supported. */
export function mapSupabaseRowToVideoItem(value: unknown): VideoItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid video row');
  }
  const row = value as Record<string, unknown>;
  const youtubeId = getYoutubeId(row.youtube_id) || getYoutubeId(row.youtubeId) || getYoutubeId(row.url);
  if (!youtubeId) throw new Error('Missing or invalid YouTube identity');
  const rawType = text(row.type, 'video').toLowerCase();
  if (rawType !== 'video' && rawType !== 'shorts') throw new Error('Invalid video format');
  const channel = text(row.channel, '未提供頻道名稱');
  const title = text(row.title, '無標題影片');
  const description = text(row.description);
  const isOfficialShort = isOfficialH2HChannel(channel) && isOfficialShortsVideo({ channel, type: rawType, title, description });
  const type: VideoType = isOfficialShort || rawType === 'shorts' ? 'shorts' : 'video';
  const category = text(row.category, 'all') as VideoCategory;
  const thumbnail = text(row.thumbnail_url) || text(row.thumbnailUrl) || text(row.thumbnail);
  const safeThumbnail = /^https?:\/\//i.test(thumbnail) ? thumbnail : `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

  const explicitMembers = parseMembers(row.members);
  const hashtagMembers = inferMembersFromTitle(title);
  const combinedMembers = [...new Set([...explicitMembers, ...hashtagMembers])];

  return {
    id: typeof row.id === 'number' ? String(row.id) : text(row.id, youtubeId),
    title,
    type,
    category: CATEGORIES.includes(category) ? category : 'all',
    channel,
    members: combinedMembers,
    duration: text(row.duration, '未提供'),
    publishedAt: parseDate(row.published_at || row.publishedAt),
    views: text(row.views),
    thumbnailUrl: safeThumbnail,
    youtubeId,
    description,
    highlightNote: text(row.highlight_note) || text(row.highlightNote) || undefined,
    group: getVideoGroup({ channel, type, title, description, category }),
  };
}

/**
 * Parse a view count string (e.g. "2,480,000 次觀看", "1.5M", "500K", "1200") to numeric value.
 */
export function parseViewsCount(views: unknown): number {
  if (typeof views === 'number' && Number.isFinite(views)) return views;
  if (typeof views !== 'string') return 0;
  const raw = views.trim();
  if (!raw) return 0;

  // Handle M (Million) or 萬 / 万
  const matchMillion = /^([\d,.]+)\s*(?:M|萬|万)/i.exec(raw);
  if (matchMillion) {
    const val = parseFloat(matchMillion[1].replace(/,/g, ''));
    return Number.isFinite(val) ? val * 1000000 : 0;
  }

  // Handle K (Thousand) or 千
  const matchK = /^([\d,.]+)\s*(?:K|千)/i.exec(raw);
  if (matchK) {
    const val = parseFloat(matchK[1].replace(/,/g, ''));
    return Number.isFinite(val) ? val * 1000 : 0;
  }

  // Handle standard comma-separated or integer digits (e.g. "2,480,000 次觀看" -> 2480000)
  const digits = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (digits) {
    const val = parseFloat(digits);
    return Number.isFinite(val) ? val : 0;
  }

  return 0;
}

/**
 * Sort an array of VideoItem by 'new', 'old', or 'popular'.
 */
export function sortVideoItems(items: VideoItem[], order: SortOrder): VideoItem[] {
  return [...items].sort((a, b) => {
    if (order === 'new') {
      const dateA = a.publishedAt || '';
      const dateB = b.publishedAt || '';
      if (dateA && dateB && dateA !== dateB) {
        return dateB.localeCompare(dateA); // newest first
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return b.id.localeCompare(a.id);
    }

    if (order === 'old') {
      const dateA = a.publishedAt || '';
      const dateB = b.publishedAt || '';
      if (dateA && dateB && dateA !== dateB) {
        return dateA.localeCompare(dateB); // oldest first
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      return a.id.localeCompare(b.id);
    }

    if (order === 'popular') {
      const viewsA = parseViewsCount(a.views);
      const viewsB = parseViewsCount(b.views);
      if (viewsA !== viewsB) {
        return viewsB - viewsA; // highest views first
      }
      // Fallback to newer date if views are equal
      const dateA = a.publishedAt || '';
      const dateB = b.publishedAt || '';
      return dateB.localeCompare(dateA);
    }

    return 0;
  });
}

/**
 * Filter an array of VideoItem by selected members with either 'including' or 'only' match mode.
 * - 'including': Video must contain all selected members (may also contain other members/group)
 * - 'only': Video members must strictly match only the selected members (e.g. exclusive 2-member pairing or solo)
 */
export function filterVideosByMembers(
  videos: VideoItem[],
  selectedMembers: MemberName[],
  matchMode: MemberMatchMode = 'including'
): VideoItem[] {
  if (selectedMembers.length === 0) return videos;

  if (matchMode === 'only') {
    return videos.filter((video) => {
      const memberSet = new Set(video.members);
      return (
        memberSet.size === selectedMembers.length &&
        selectedMembers.every((m) => memberSet.has(m))
      );
    });
  }

  // Default: 'including' mode
  return videos.filter((video) =>
    selectedMembers.every((m) => video.members.includes(m))
  );
}


