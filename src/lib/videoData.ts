/** @license SPDX-License-Identifier: Apache-2.0 */

import type { MemberMatchMode, MemberName, SortOrder, VideoCategory, VideoGenre, VideoItem } from '../types';
import {
  canonicalMember,
  classifyVideoGenre,
  classifyVideoGenres,
  detectMembers,
  getYoutubeId,
  hasShortsFormatEvidence,
} from './videoMetadata.cjs';

export { classifyVideoGenre, classifyVideoGenres, getYoutubeId, hasShortsFormatEvidence };

export const FIVE_CATEGORIES: Record<VideoGenre, { label: string; englishLabel: string; shortLabel: string }> = {
  mv: { label: '音樂錄影帶', englishLabel: 'Music Video', shortLabel: 'MV' },
  shorts: { label: '官方 Shorts 與挑戰', englishLabel: 'Official Shorts / Challenges', shortLabel: 'Shorts' },
  stage: { label: '舞台表演', englishLabel: 'Stage / Performance', shortLabel: '舞台' },
  original: { label: '綜藝與 Vlog', englishLabel: 'Variety / Vlog', shortLabel: '綜藝' },
  other: { label: '其他影音', englishLabel: 'Other Video', shortLabel: '其他' },
};
const CATEGORIES: readonly VideoCategory[] = ['all', 'mv', 'shorts', 'stage', 'original', 'other', 'dance', 'vlog', 'variety'];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

/** Existing tags (including an explicit empty list) are authoritative over text inference. */
export function normalizeMembers(value: unknown): MemberName[] {
  let entries: unknown[] = [];
  if (Array.isArray(value)) entries = value;
  else if (typeof value === 'string') {
    if (value.trim().startsWith('[')) {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('Invalid members JSON');
      entries = parsed;
    } else entries = value.split(',');
  } else if (value != null) throw new Error('Invalid members metadata');
  return [...new Set(entries.flatMap(entry => {
    const member = canonicalMember(entry);
    return member ? [member] : [];
  }))];
}

/** All category-tab memberships for a video (may include more than one). */
export function getVideoGroups(video: Partial<VideoItem>): VideoGenre[] {
  if (Array.isArray(video.genres) && video.genres.length > 0) {
    return [...new Set(video.genres)];
  }
  if (video.genre) return [video.genre];
  return classifyVideoGenres(video.title, video.description, video.channel, video.url, video.type);
}

/** Primary category tab (first membership). */
export function getVideoGroup(video: Partial<VideoItem>): VideoGenre {
  return getVideoGroups(video)[0];
}

export function videoMatchesGenre(video: Partial<VideoItem>, genre: VideoGenre): boolean {
  return getVideoGroups(video).includes(genre);
}

function parseDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = raw.split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(raw)) ||
      new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Invalid publication date');
  return date;
}

function safeThumbnail(value: string, youtubeId: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch { /* Invalid/missing metadata uses a known thumbnail endpoint. */ }
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

/** Explicit, runtime-validated legacy/canonical boundary. No invented identities or dates. */
export function mapSupabaseRowToVideoItem(value: unknown): VideoItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid video row');
  const row = value as Record<string, unknown>;
  const youtubeId = getYoutubeId(row.youtube_id) || getYoutubeId(row.youtubeId) || getYoutubeId(row.url);
  if (!youtubeId) throw new Error('Missing or invalid YouTube identity');
  const rawType = text(row.type, 'video').toLowerCase();
  // Preserve rows produced by the earlier five-category importer, but normalize format.
  if (!['video', 'shorts', 'mv', 'stage', 'original', 'other'].includes(rawType)) throw new Error('Invalid video format');
  const category = text(row.category, 'all') as VideoCategory;
  const title = text(row.title, '無標題影片');
  const description = text(row.description);
  const channel = text(row.channel, '未提供頻道名稱');
  const sourceUrl = text(row.url);
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;
  const genres = classifyVideoGenres(title, description, channel, sourceUrl, rawType);
  const genre = genres[0];
  const physicalShorts = hasShortsFormatEvidence(title, description, sourceUrl, rawType)
    || genres.includes('shorts');
  return {
    id: typeof row.id === 'number' && Number.isFinite(row.id) ? String(row.id) : text(row.id, youtubeId),
    title, description, channel, url, youtubeId, genre, genres,
    type: physicalShorts ? 'shorts' : 'video',
    category: CATEGORIES.includes(category) ? category : 'all',
    members: normalizeMembers(row.members),
    duration: text(row.duration, '未提供'),
    publishedAt: parseDate(row.published_at ?? row.publishedAt),
    views: typeof row.views === 'number' && Number.isFinite(row.views) && row.views >= 0 ? String(row.views) : text(row.views),
    thumbnailUrl: safeThumbnail(text(row.thumbnail_url) || text(row.thumbnailUrl) || text(row.thumbnail), youtubeId),
    highlightNote: text(row.highlight_note) || text(row.highlightNote) || undefined,
  };
}

/**
 * Stored-tag filter. Change match behavior only here.
 * - no selection: every video
 * - including (default) and legacy AND: members[] contains every selected name; extras allowed
 * - only: members[] is exactly the selected set (same names, no extras)
 * - legacy OR: at least one selected name is present
 * Comparison uses stored members[] only. Tags are saved associations, not who is on screen.
 */
export function filterVideosByMembers(
  videos: VideoItem[], selectedMembers: MemberName[], matchMode: MemberMatchMode = 'including',
): VideoItem[] {
  if (selectedMembers.length === 0) return videos;
  const selected = [...new Set(selectedMembers)];
  return videos.filter(video => {
    const members = normalizeMembers(video.members);
    if (matchMode === 'OR') return selected.some(member => members.includes(member));
    const containsAll = selected.every(member => members.includes(member));
    if (!containsAll) return false;
    return matchMode !== 'only' || selected.length === members.length;
  });
}

export function parseViewsCount(value: unknown = ''): number {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : 0;
  if (typeof value !== 'string') return 0;
  const match = value.trim().replace(/,/g, '').match(/^(\d+(?:\.\d+)?)\s*([KMB萬万億亿])?(?=\s|次|觀看|观看|views?\b|$)/iu);
  if (!match) return 0;
  const units: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, 萬: 1e4, 万: 1e4, 億: 1e8, 亿: 1e8 };
  const count = Number(match[1]) * (units[match[2]?.toUpperCase()] || 1);
  return Number.isFinite(count) ? count : 0;
}

export function sortVideoItems(videos: VideoItem[], order: SortOrder = 'new'): VideoItem[] {
  const time = (video: VideoItem) => {
    const timestamp = Date.parse(video.publishedAt);
    return Number.isFinite(timestamp) ? timestamp : null;
  };
  return [...videos].sort((a, b) => {
    if (order === 'popular') {
      const views = parseViewsCount(b.views) - parseViewsCount(a.views);
      if (views) return views;
    }
    // Unknown dates stay last in either direction; tie-break by stable identity.
    const aTime = time(a), bTime = time(b);
    if (aTime === null || bTime === null) return aTime === bTime ? a.id.localeCompare(b.id) : aTime !== null ? -1 : 1;
    return (order === 'old' ? aTime - bTime : bTime - aTime) || a.id.localeCompare(b.id);
  });
}

export { detectMembers as detectMembersFromText };
